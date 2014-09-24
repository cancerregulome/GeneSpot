define([
    "jquery", "underscore", "backbone", "d3", "vq",
    "models/gs/protein_domain_model",
    "seqpeek/util/data_adapters",
    "seqpeek/builders/builder_for_existing_elements",
    "seqpeek/util/mini_locator",
    "views/seqpeek/sample_list_operations_view",
    "views/seqpeek/color_by_legend_view",

    "./color_mapping/lesk_amino_acid",

    "hbs!templates/seqpeek/mutations_map",
    "hbs!templates/seqpeek/mutations_map_table",
    "hbs!templates/seqpeek/sample_list_dropdown_caption"
],
    function ($, _, Backbone, d3, vq,
              ProteinDomainModel, SeqPeekDataAdapters, SeqPeekBuilder, SeqPeekMiniLocatorFactory,
              SampleListOperationsView,
              ColorByLegendView,
              AminoAcidColorMappingFactory,
              MutationsMapTpl, MutationsMapTableTpl,
              SampleListCaptionTpl
    ) {
        var SAMPLE_HIGHLIGHT_MODES = {
            ALL: 1,
            HIGHLIGHT_SELECTED: 2
        };

        var DISPLAY_MODES = {
            ALL: 1,
            PROTEIN: 2
        };

        var MINI_LOCATOR_WIDTH = 400;
        var MINI_LOCATOR_HEIGHT = 24;

        var Y_AXIS_SCALE_WIDTH = 50;

        var VARIANT_TRACK_MAX_HEIGHT = 150;
        var TICK_TRACK_HEIGHT = 25;
        var REGION_TRACK_HEIGHT = 5;
        var PROTEIN_DOMAIN_HEIGHT = 20;
        var PROTEIN_DOMAIN_TRACK_HEIGHT = 40;
        var VIEWPORT_WIDTH = 1500;
        var SAMPLE_PLOT_TRACK_STEM_HEIGHT = 30;
        var TRACK_SVG_WIDTH = VIEWPORT_WIDTH + Y_AXIS_SCALE_WIDTH;

        var AMINO_ACID_POSITION_FIELD_NAME = "amino_acid_position";
        var COORDINATE_FIELD_NAME = "chromosome_position";
        var TYPE_FIELD_NAME = "mutation_type";
        var AMINO_ACID_MUTATION_FIELD_NAME = "amino_acid_mutation";
        var AMINO_ACID_WILDTYPE_FIELD_NAME = "amino_acid_wildtype";
        var DNA_CHANGE_FIELD_NAME = "dna_change";
        var UNIPROT_FIELD_NAME = "uniprot_id";

        var DNA_CHANGE_KEY_FN = function(data_point) {
            var id = data_point[DNA_CHANGE_FIELD_NAME];
            var base_pairs = id.split("->");

            // Single base substitution?
            if (base_pairs[0] != "-" && base_pairs[0].length == 1 &&
                base_pairs[1] != "-" && base_pairs[1].length == 1) {
                return "SUBSTITUTION";
            }
            // Deletion?
            else if (base_pairs[1] == "-") {
                return "DELETION";
            }
            // Insertion of single base pair?
            else if (base_pairs[0] == "-" && base_pairs[1].length == 1) {
                return "INSERTION";
            }
            // Insertion of two or more base pairs?
            else if (base_pairs[0] == "-" && base_pairs[1].length > 1) {
                return "INSERTION+";
            }
            else {
                return "UNKNOWN " + id;
            }
        };

        var MUTATION_TYPE_KEY_FN = function(data_point) {
            return data_point[TYPE_FIELD_NAME];
        };

        var PROTEIN_CHANGE_KEY_FN = function(data_row) {
            return data_row[AMINO_ACID_MUTATION_FIELD_NAME] + "-" + data_row[AMINO_ACID_WILDTYPE_FIELD_NAME];
        };

        var GROUP_BY_CATEGORIES_FOR_PROTEIN_VIEW = {
            "Mutation Type": TYPE_FIELD_NAME,
            "DNA Change": DNA_CHANGE_KEY_FN,
            "Protein Change": PROTEIN_CHANGE_KEY_FN
        };

        var GROUP_BY_CATEGORIES_FOR_GENOMIC_VIEW = {
            "Mutation Type": TYPE_FIELD_NAME,
            "DNA Change": DNA_CHANGE_KEY_FN,
            "Protein Change": PROTEIN_CHANGE_KEY_FN
        };

        var MUTATION_TYPE_COLOR_MAP = {
            Nonsense_Mutation: "red",
            Silent: "green",
            Frame_Shift_Del: "gold",
            Frame_Shift_Ins: "gold",
            Missense_Mutation: "blue"
        };

        var TCGA_SIX_CATEGORIES = [
            "#71C560",
            "#9768C4",
            "#98B8B8",
            "#4F473D",
            "#C1B14C",
            "#B55381"
        ];

        var DNA_CHANGE_COLOR_MAP = {
            "SUBSTITUTION": {label: "Substitution", color: TCGA_SIX_CATEGORIES[0]},
            "DELETION":  {label: "Deletion", color:TCGA_SIX_CATEGORIES[1]},
            "INSERTION": {label: "Insertion (single base pair)", color:TCGA_SIX_CATEGORIES[2]},
            "INSERTION+": {label: "Insertion (multiple base pairs)", color: TCGA_SIX_CATEGORIES[3]}
        };

        var LOLLIPOP_COLOR_SCALE = d3.scale.category20();

        var NOT_SELECTED_DATA_POINT_COLOR = "rgba(170,170,170,0.2)";
        var UNKNOWN_TYPE_COLOR = "rgba(170,170,170,1.0)";

        var amino_acid_wildtype_color_map = AminoAcidColorMappingFactory.create();
        amino_acid_wildtype_color_map._amino_acid_mutation_field_name = AMINO_ACID_WILDTYPE_FIELD_NAME;

        var COLOR_BY_CATEGORIES = {
            "Mutation Type": {
                data_getter: MUTATION_TYPE_KEY_FN,
                color_fn: function (data_point) {
                    var id = MUTATION_TYPE_KEY_FN(data_point);
                    if (_.has(MUTATION_TYPE_COLOR_MAP, id)) {
                        return {
                            label: id,
                            color: MUTATION_TYPE_COLOR_MAP[id]
                        };
                    }
                    else {
                        return {
                            label: id,
                            color: UNKNOWN_TYPE_COLOR
                        };
                    }
                }
            },
            "DNA Change": {
                data_getter: DNA_CHANGE_KEY_FN,
                color_fn: function(data_point) {
                    var id = DNA_CHANGE_KEY_FN(data_point);
                    if (_.has(DNA_CHANGE_COLOR_MAP, id)) {
                        return DNA_CHANGE_COLOR_MAP[id];
                    }
                    else {
                        return {label: id, color: UNKNOWN_TYPE_COLOR};
                    }
                }
            },
            "Amino Acid Mutation": AminoAcidColorMappingFactory.create(),
            "Amino Acid Wildtype": amino_acid_wildtype_color_map
        };

        var COLOR_BY_CATEGORIES_FOR_BAR_PLOT = {
            "Mutation Type": function(category_name, type_name) {
                if (_.has(MUTATION_TYPE_COLOR_MAP, type_name)) {
                    return MUTATION_TYPE_COLOR_MAP[type_name];
                }
                else {
                    return UNKNOWN_TYPE_COLOR;
                }
            },
            "DNA Change": function(category_name, type_name) {
                return LOLLIPOP_COLOR_SCALE(type_name);
            },
            "Protein Change": function(category_name, type_name) {
                return LOLLIPOP_COLOR_SCALE(type_name);
            }
        };

        return Backbone.View.extend({
            "genes": [],
            "tumor_types": [],
            "model": {},

            events: {
                "click .seqpeek-gene-selector li a": function(e) {
                    this.selected_gene = $(e.target).data("id");
                    this.$el.find(".selected-gene").html(this.selected_gene);

                    this.__render();
                },

                "click .dropdown-menu.group_by_selector a": function(e) {
                    var group_by = $(e.target).data("id");

                    this.selected_group_by = this.__get_current_group_by(group_by);
                    this.selected_bar_plot_color_by = COLOR_BY_CATEGORIES_FOR_BAR_PLOT[group_by];

                    this.$(".dropdown-menu.group_by_selector").find(".active").removeClass("active");
                    $(e.target).parent("li").addClass("active");

                    this.__render();
                },

                "click .dropdown-menu.color_by_selector a": function(e) {
                    var color_by = $(e.target).data("id");
                    this.selected_color_by_key = color_by;
                    this.selected_color_by = this.__get_current_sample_color_by(color_by);

                    this.$(".dropdown-menu.color_by_selector").find(".active").removeClass("active");
                    $(e.target).parent("li").addClass("active");

                    this.__render();
                },

                "click .btn.seqpeek-samplelist-highlight": function(e) {
                    if (this.sample_highlight_mode == SAMPLE_HIGHLIGHT_MODES.ALL) {
                        this.sample_highlight_mode = SAMPLE_HIGHLIGHT_MODES.HIGHLIGHT_SELECTED
                    }
                    else {
                        this.sample_highlight_mode = SAMPLE_HIGHLIGHT_MODES.ALL
                    }

                    this.__update_sample_highlight_button_label();
                    this.__update_settings();
                    this.__render();

                },

                "click .btn.seqpeek-zoom-enable": function(e) {
                    this.__enable_seqpeek_zoom();
                },

                "click .btn.seqpeek-selection-enable": function(e) {
                    this.__enable_seqpeek_selection();
                },

                "click .btn.seqpeek-toggle-bars": function(e) {
                    if (this.sample_track_type_user_setting == "bar_plot") {
                        this.sample_track_type_user_setting = "sample_plot";
                    }
                    else {
                        this.sample_track_type_user_setting = "bar_plot";
                    }
                    this.__update_scaling_button_label();
                    this.__render();
                },

                "click .add-new-list": function() {
                    this.__store_sample_list();
                }
            },

            initialize: function () {
                this.model = this.options["models"];

                this.sample_track_type = "sample_plot";
                this.sample_track_type_user_setting = this.sample_track_type;

                this.sample_highlight_mode = SAMPLE_HIGHLIGHT_MODES.ALL;
                this.current_view_mode = DISPLAY_MODES.PROTEIN;

                this.selected_group_by = this.__get_current_group_by("Mutation Type");
                this.selected_color_by_key = "Mutation Type";
                this.selected_color_by = this.__get_current_sample_color_by(this.selected_color_by_key);
                this.selected_bar_plot_color_by = COLOR_BY_CATEGORIES_FOR_BAR_PLOT["Mutation Type"];

                this.selected_patient_ids = [];

                this.samplelists = WebApp.getItemSets();

                this.sample_list_op_view = new SampleListOperationsView({
                    collection: this.samplelists
                });

                this.selected_samples_map = null;

                this.sample_list_op_view.on("list:union", this.__sample_list_union, this);

                this.samplelists.on("add", this.__update_stored_samplelists, this);
                this.samplelists.on("remove", this.__update_stored_samplelists, this);
            },

            __update_settings: function() {
                this.selected_samples_map = this.sample_list_op_view.getCurrentListAsMap();
            },

            __get_current_sample_color_by: function(color_by_key) {
                return COLOR_BY_CATEGORIES[color_by_key];
            },

            __get_current_group_by: function(group_by_key) {
                if (this.current_view_mode == DISPLAY_MODES.PROTEIN) {
                    return GROUP_BY_CATEGORIES_FOR_PROTEIN_VIEW[group_by_key];
                }
                else {
                    return GROUP_BY_CATEGORIES_FOR_GENOMIC_VIEW[group_by_key];
                }
            },

            __update_gene_dropdown_labels: function(gene_to_uniprot_mapping) {
                _.each(this.genes, function(gene_label) {
                    var $el = this.$el.find(".seqpeek-gene-selector a[data-id=" + gene_label + "]");

                    if (_.has(gene_to_uniprot_mapping, gene_label)) {
                        $el.text(gene_label);
                    }
                    else {
                        $el.text(gene_label + " NO DATA");
                    }
                }, this);
            },

            render: function() {
                this.tumor_types = this.options["tumor_types"];
                this.genes = this.options["genes"] || [];
                if (!_.isEmpty(this.genes)) this.selected_gene = _.first(this.genes);

                var renderFn = _.after(1 + (2 * this.tumor_types.length), this.__preprocess_data_and_render);

                this.model["mutsig"].on("load", renderFn, this);

                _.each(this.model["mutations"]["by_tumor_type"], function(model) {
                    model.on("load", renderFn, this);
                }, this);
                _.each(this.model["mutated_samples"]["by_tumor_type"], function(model) {
                    model.on("load", renderFn, this);
                }, this);

                this.$el.html(MutationsMapTpl({
                    "selected_gene": this.selected_gene,
                    "genes": this.genes,
                    "selected_group_by": "Mutation Type",
                    "group_by_categories": _.keys(GROUP_BY_CATEGORIES_FOR_PROTEIN_VIEW),
                    "color_by_categories": _.keys(COLOR_BY_CATEGORIES)
                }));

                this.$(".mutations_map_table").html(MutationsMapTableTpl({
                    "items": _.map(this.tumor_types, function (tumor_type) {
                        return { "tumor_type_label": tumor_type };
                    })
                }));

                this.__update_sample_list_dropdown();
                this.__update_sample_highlight_button_label();
                this.__update_scaling_button_label();

                this.$el.find(".sample-list-operations").html(this.sample_list_op_view.render().el);

                this.color_by_legend_view = new ColorByLegendView({
                    el: this.$el.find(".color_by_legend")[0]
                });

                var $sample_list_dropdown = $(this.$el.find("a.sample-list-dropdown"));

                // Manually open and close the sample list dialog dropdown. The dropdown
                // will not close when clicking outside.
                $sample_list_dropdown.on("click.dropdown.data-api", function(e) {
                    var parent = $(this.parentNode);
                    var is_open = parent.hasClass("open");

                    if (is_open == false) {
                        parent.addClass("open");
                    }
                    else {
                        parent.removeClass("open");
                    }
                });

                return this;
            },

            __render: function () {
                this.$(".mutations_map_table").html("");

                var mutations = this.__filter_data();

                var mutsig_ranks = this.__filter_mutsig_data(this.__parse_mutsig());

                var data_items = _.map(this.tumor_types, function (tumor_type) {
                    var statistics = {
                        samples: {
                            numberOf: 0,
                            totals: {
                                percentOf: "NA"
                            }
                        }
                    };

                    if (_.has(mutations, tumor_type)) {
                        statistics.samples.numberOf = _.chain(mutations[tumor_type])
                            .pluck('patient_id')
                            .unique()
                            .value()
                            .length;
                    }

                    var by_tumor_type = this.model["mutated_samples"]["by_tumor_type"];
                    if (by_tumor_type) {
                        var tt_model = by_tumor_type[tumor_type];
                        if (tt_model) {
                            var totals_per_gene_array = tt_model.get("items");
                            if (!_.isEmpty(totals_per_gene_array)) {
                                var stats_for_gene = _.findWhere(totals_per_gene_array, { "gene": this.selected_gene });
                                if (stats_for_gene && _.has(stats_for_gene, "numberOf")) {
                                    var total = stats_for_gene["numberOf"];
                                    if (_.isNumber(total)) {
                                        statistics.samples.totals = {
                                            percentOf: "NA"
                                        };
                                    }
                                }
                            }
                        }
                    }

                    var mutsig_rank;
                    var tumor_type_lower = tumor_type.toLowerCase();

                    if (_.has(mutsig_ranks, tumor_type_lower)) {
                        var mutsig_data = mutsig_ranks[tumor_type_lower];
                        if (!_.isEmpty(mutsig_data)) {
                            mutsig_rank = _.first(mutsig_data)["rank"];
                        }
                    }

                    return {
                        tumor_type_label: tumor_type,
                        tumor_type: tumor_type,
                        mutsig_rank: mutsig_rank,
                        statistics: statistics
                    };
                }, this);

                var seqpeek_data = [];

                this.__update_gene_dropdown_labels(this.gene_to_uniprot_mapping);

                if (! _.has(this.gene_to_uniprot_mapping, this.selected_gene)) {
                    this.$(".mutations_map_table").html(MutationsMapTableTpl({
                        "items": data_items,
                        "total": {
                            samples: "No data",
                            percentOf: "NA"
                        }}));

                    return;
                }

                var uniprot_id = this.gene_to_uniprot_mapping[this.selected_gene];
                var protein_data = this.found_protein_domains[uniprot_id];

                var all_mutations = [];
                _.each(this.__filter_data(), function(mutation_array, tumor_type) {
                    Array.prototype.push.apply(all_mutations, mutation_array);
                });

                var region_data = this.__build_regions(all_mutations, 0, protein_data["length"]);

                _.each(this.tumor_types, function (tumor_type) {
                    var variants = mutations[tumor_type];
                    if (_.isEmpty(variants)) return;

                    seqpeek_data.push({
                        variants: variants,
                        tumor_type: tumor_type,
                        is_summary_track: false,
                        y_axis_type: this.sample_track_type_user_setting == "sample_plot" ? "lin" : "log2"
                    });
                }, this);

                // Aggregate the data and create the element for the summary track
                var summary_track_info = this.__create_data_for_summary_track(seqpeek_data);
                var total_unique_samples = _.chain(summary_track_info.variants)
                    .pluck('patient_id')
                    .unique()
                    .value()
                    .length;

                this.$(".mutations_map_table").html(MutationsMapTableTpl({
                    "items": data_items,
                    "total": {
                        samples: total_unique_samples,
                        percentOf: "NA"
                    }}));

                _.each(seqpeek_data, function(track_obj) {
                    track_obj.target_element = _.first(this.$("#seqpeek-row-" + track_obj.tumor_type))
                }, this);

                summary_track_info.target_element = _.first(this.$("#seqpeek-all-row"));
                seqpeek_data.push(summary_track_info);

                var seqpeek_tick_track_element = _.first(this.$("#seqpeek-tick-element"));
                var seqpeek_domain_track_element = _.first(this.$("#seqpeek-protein-domain-element"));

                this.maximum_samples_in_location = this.__find_maximum_samples_in_location(seqpeek_data);
                if (this.maximum_samples_in_location >= this.options.bar_plot_threshold) {
                    this.sample_track_type = "bar_plot";
                }

                this.color_by_legend_view.setData(this.selected_color_by_key, this.selected_color_by, summary_track_info.variants);

                var filtered_protein_domain_matches = this.__filter_protein_domain_matches(protein_data["matches"], "PFAM");

                this.__render_tracks(seqpeek_data, region_data, protein_data, filtered_protein_domain_matches, seqpeek_tick_track_element, seqpeek_domain_track_element);
            },

            __build_seqpeek_config: function(region_array) {
                if (this.current_view_mode == DISPLAY_MODES.PROTEIN) {
                    return this.__build_seqpeek_config_for_protein_view(region_array);
                }
                else {
                    return this.__build_seqpeek_config_for_genomic_view(region_array);
                }
            },

            __build_seqpeek_config_for_protein_view: function(region_array) {
                var self = this;

                var sample_plot_color_by_function = function(data_point) {
                    if (self.sample_highlight_mode == SAMPLE_HIGHLIGHT_MODES.ALL) {
                        return self.selected_color_by.color_fn(data_point).color;
                    }
                    else {
                        if (_.has(self.selected_samples_map, data_point["patient_id"])) {
                            return self.selected_color_by.color_fn(data_point).color;
                        }
                        else {
                            return NOT_SELECTED_DATA_POINT_COLOR;
                        }
                    }
                };

                return {
                    region_data: region_array,
                    viewport: {
                        width: VIEWPORT_WIDTH
                    },
                    bar_plot_tracks: {
                        bar_width: 5.0,
                        height: VARIANT_TRACK_MAX_HEIGHT,
                        stem_height: SAMPLE_PLOT_TRACK_STEM_HEIGHT,
                        color_scheme: this.selected_bar_plot_color_by
                    },
                    sample_plot_tracks: {
                        height: VARIANT_TRACK_MAX_HEIGHT,
                        stem_height: 30,
                        color_scheme: sample_plot_color_by_function
                    },
                    region_track: {
                        height: REGION_TRACK_HEIGHT,
                        color_scheme: {
                            "exon": "#555555"
                        }
                    },
                    protein_domain_tracks: {
                        source_key: "dbname",
                        source_order: ["PFAM", "SMART", "PROFILE"],
                        color_scheme: {
                            "PFAM": "lightgray",
                            "SMART": "darkgray",
                            "PROFILE": "gray"
                        },
                        label: function(match) {
                            return match["name"]
                        },
                        domain_height: PROTEIN_DOMAIN_HEIGHT
                    },
                    tick_track: {
                        height: TICK_TRACK_HEIGHT
                    },
                    region_layout: {
                        intron_width: 10,
                        exon_width: VIEWPORT_WIDTH

                    },
                    variant_layout: {
                        variant_width: 5.0
                    },
                    variant_data_location_field: AMINO_ACID_POSITION_FIELD_NAME,
                    variant_data_type_field: this.selected_group_by,
                    variant_data_source_field: "patient_id",
                    selection_handler: _.bind(this.__seqpeek_selection_handler, this)
                };
            },

            __build_seqpeek_config_for_genomic_view: function(region_array) {
                return {
                    region_data: region_array,
                    viewport: {
                        width: VIEWPORT_WIDTH
                    },
                    bar_plot_tracks: {
                        bar_width: 5.0,
                        height: VARIANT_TRACK_MAX_HEIGHT,
                        stem_height: SAMPLE_PLOT_TRACK_STEM_HEIGHT,
                        color_scheme: this.selected_bar_plot_color_by
                    },
                    sample_plot_tracks: {
                        height: VARIANT_TRACK_MAX_HEIGHT,
                        stem_height: 30,
                        color_scheme: _.bind(this.selected_color_by, this)
                    },
                    region_track: {
                        height: REGION_TRACK_HEIGHT
                    },
                    protein_domain_tracks: {
                        source_key: "dbname",
                        source_order: ["PFAM", "SMART", "PROFILE"],
                        color_scheme: {
                            "PFAM": "lightgray",
                            "SMART": "darkgray",
                            "PROFILE": "gray"
                        }
                    },
                    tick_track: {
                        height: TICK_TRACK_HEIGHT
                    },
                    region_layout: {
                        intron_width: 50.0,
                        exon_width: function(region) {
                            return _.max([10, region.end_aa - region.start_aa]);
                        }
                    },
                    variant_layout: {
                        variant_width: 5.0
                    },
                    variant_data_location_field: COORDINATE_FIELD_NAME,
                    variant_data_type_field: this.selected_group_by,
                    variant_data_source_field: "patient_id",
                    selection_handler: _.bind(this.__seqpeek_selection_handler, this)
                };
            },

            __render_tracks: function(mutation_data, region_array, protein_data, protein_domain_matches, seqpeek_tick_track_element, seqpeek_domain_track_element) {
                var seqpeek_config = this.__build_seqpeek_config(region_array);
                var seqpeek = SeqPeekBuilder.create(seqpeek_config);

                _.each(mutation_data, function(track_obj) {
                    var track_guid = "C" + vq.utils.VisUtils.guid();
                    var track_elements_svg = d3.select(track_obj.target_element)
                        .append("svg")
                        .attr("width", TRACK_SVG_WIDTH)
                        .attr("height", VARIANT_TRACK_MAX_HEIGHT + PROTEIN_DOMAIN_HEIGHT)
                        .attr("id", track_guid)
                        .style("pointer-events", "none");

                    var sample_plot_track_g = track_elements_svg
                        .append("g")
                        .style("pointer-events", "none")
                        .call(this.__set_track_g_position);

                    var region_track_g = track_elements_svg
                        .append("g")
                            .style("pointer-events", "none")
                            .call(this.__set_track_g_position)
                        .append("g")
                        .style("pointer-events", "none");

                    track_obj.track_info = this.__add_data_track(track_obj, seqpeek, track_guid, sample_plot_track_g);
                    track_obj.variant_track_svg = track_elements_svg;
                    track_obj.sample_plot_track_g = sample_plot_track_g;

                    seqpeek.addRegionScaleTrackToElement(region_track_g, {
                        guid: track_guid,
                        hovercard_content: {
                            "Protein location": function(d) {
                                return d["start_aa"] + " - " + d["end_aa"];
                            },
                            "Genomic coordinates": function(d) {
                                return d["start"] + " - " + d["end"];
                            },
                            "Protein length": function () {
                                return protein_data["length"];
                            },
                            "Name": function () {
                                return protein_data["name"];
                            },
                            "UniProt ID": function () {
                                return protein_data["uniprot_id"];
                            }
                        },
                        hovercard_links: {
                            "UniProt": {
                                label: "UniProt",
                                url: '/',
                                href: "http://www.uniprot.org/uniprot/" + protein_data["uniprot_id"]
                            }
                        }
                    });

                    seqpeek.addProteinDomainTrackToElement(protein_domain_matches, region_track_g, {
                        guid: track_guid,
                        hovercard_content: {
                            "DB": function (d) {
                                return d.dbname;
                            },
                            "EVD": function (d) {
                                return d.evd;
                            },
                            "ID": function (d) {
                                return d.id;
                            },
                            "Name": function (d) {
                                return d.name;
                            },
                            "Status": function (d) {
                                return d.status;
                            },
                            "LOC": function (d) {
                                return d.start + " - " + d.end;
                            }
                        },
                        hovercard_links: {
                            "InterPro Domain Entry": {
                                label: 'InterPro',
                                url: '/',
                                href: function (param) {
                                    var ipr_id = param["ipr"]["id"];
                                    return "http://www.ebi.ac.uk/interpro/entry/" + ipr_id;
                                }
                            }
                        }
                    });

                    track_obj.region_track_svg = region_track_g;
                }, this);

                var tick_track_g = d3.select(seqpeek_tick_track_element)
                    .append("svg")
                        .attr("width", TRACK_SVG_WIDTH)
                        .attr("height", TICK_TRACK_HEIGHT)
                        .style("pointer-events", "none")
                    .append("svg:g")
                        .call(this.__set_track_g_position);

                seqpeek.addTickTrackToElement(tick_track_g);

                seqpeek.createInstances();

                _.each(mutation_data, function(track_obj) {
                    var track_info = track_obj.track_info;
                    var track_instance = track_info.track_instance;

                    track_instance.setHeightFromStatistics();
                    var variant_track_height = track_instance.getHeight();
                    var total_track_height = variant_track_height + PROTEIN_DOMAIN_HEIGHT;

                    track_obj.variant_track_svg.attr("height", total_track_height);
                    track_obj.region_track_svg
                        .attr("transform", "translate(0," + (variant_track_height) + ")");

                    this.__render_scales(track_obj.variant_track_svg, total_track_height, track_instance.statistics, track_obj.y_axis_type);
                }, this);

                var regions_start_coordinate = seqpeek.getRegionMetadata().start_coordinate;
                var regions_end_coordinate = seqpeek.getRegionMetadata().end_coordinate;

                var mini_locator_scale = MINI_LOCATOR_WIDTH / seqpeek.getRegionMetadata().total_width;
                this.__create_mini_locator(seqpeek.getProcessedRegionData(), seqpeek.region_layout, mini_locator_scale, regions_start_coordinate, regions_end_coordinate);

                seqpeek.scrollEventCallback(_.bind(function(d) {
                    var visible_coordinates = d.visible_coordinates;
                    this.mini_locator.render(visible_coordinates[0], visible_coordinates[1]);
                }, this));
                seqpeek.render();

                this.seqpeek = seqpeek;
            },

            __create_mini_locator: function(region_data, region_layout, scale, start_coordinate, end_coordinate) {
                var $mini_locator = this.$el.find(".seqpeek-mini-locator")
                    .attr("width", MINI_LOCATOR_WIDTH)
                    .attr("height", MINI_LOCATOR_HEIGHT);

                this.mini_locator = SeqPeekMiniLocatorFactory.create($mini_locator[0])
                    .data(region_data)
                    .region_layout(region_layout)
                    .scale(scale);

                this.mini_locator.render(start_coordinate, end_coordinate);
            },

            __set_track_g_position: function(track_selector) {
                track_selector
                    .attr("transform", "translate(" + Y_AXIS_SCALE_WIDTH + ",0)");
            },

            __render_scales: function(track_selector, total_track_height, track_statistics, scale_type_label) {
                if (track_statistics.max_samples_in_location <= 2) {
                    this.__render_scales_minimal(track_selector, total_track_height, track_statistics, scale_type_label);
                }
                else {
                    this.__render_scales_full(track_selector, total_track_height, track_statistics, scale_type_label);
                }
            },

            __render_scales_full: function(track_selector, total_track_height, track_statistics, scale_type_label) {
                var y_axis_label_font_size = 10;
                var y_axis_label_x = 10;

                var right = Y_AXIS_SCALE_WIDTH - 10;
                var scale_start = -(REGION_TRACK_HEIGHT + SAMPLE_PLOT_TRACK_STEM_HEIGHT);
                var type_label_x = 20.0;
                var type_label_y = scale_start + 15.0;

                var axis = track_selector
                    .append("svg:g")
                    .attr("class", "y-axis")
                    .attr("transform", "translate(0," + total_track_height + ")");

                axis
                    .append("svg:line")
                    .attr("y1", scale_start)
                    .attr("x1", right)
                    .attr("y2", -total_track_height)
                    .attr("x2", right)
                    .style("stroke", "black");

                var domain = [
                    track_statistics.min_samples_in_location,
                    track_statistics.max_samples_in_location
                ];

                var scale = d3.scale.linear().domain(domain).range([scale_start, -total_track_height]);
                var ticks = [
                    {
                        text: domain[0],
                        y: scale(domain[0]),
                        text_y: -5
                    },
                    {
                        text: domain[1],
                        y: scale(domain[1]) + 1,
                        text_y: +13
                    }
                ];

                var tick_g = axis
                    .selectAll(".tick")
                    .data(ticks)
                    .enter()
                    .append("svg:g")
                        .attr("class", "y-axis-tick")
                        .attr("transform", function(d) {
                            return "translate(0," + d.y + ")";
                        });

                tick_g
                    .append("svg:line")
                        .attr("y1", 0.0)
                        .attr("y2", 0.0)
                        .attr("x1", right - 10)
                        .attr("x2", right)
                        .style("stroke", "black");
                tick_g
                    .append("svg:text")
                    .attr("x", right - 15)
                    .attr("y", function(d) {
                        return d.text_y;
                    })
                    .text(function(d) {
                        return d.text;
                    })
                    .style("text-anchor", "end");

                axis.append("svg:text")
                    .attr("x", type_label_x)
                    .attr("y", type_label_y)
                    .text(scale_type_label);

                axis.append("svg:text")
                    .attr("x", 0)
                    // Use the "y" attribute for horizontal positioning, because of the rotation.
                    .attr("y", y_axis_label_x)
                    .attr("transform", "rotate(-90)")
                    .attr("font-size", y_axis_label_font_size)
                    .text("Samples in location");
            },

            __render_scales_minimal: function(track_selector, total_track_height, track_statistics, scale_type_label) {
                var y_axis_label_font_size = 10;
                var y_axis_label_x = 10;

                var right = Y_AXIS_SCALE_WIDTH - 10;
                var scale_start = -(REGION_TRACK_HEIGHT + SAMPLE_PLOT_TRACK_STEM_HEIGHT);
                var type_label_x = 20.0;
                var type_label_y = scale_start + 30.0;

                var axis = track_selector
                    .append("svg:g")
                    .attr("class", "y-axis")
                    .attr("transform", "translate(0," + total_track_height + ")");

                axis.append("svg:text")
                    .attr("x", right - 15)
                    .attr("y", -total_track_height + 10)
                    .attr("font-size", y_axis_label_font_size)
                    .text("max " + track_statistics.max_samples_in_location);

                axis.append("svg:text")
                    .attr("x", right - 15)
                    .attr("y",  -total_track_height + 20)
                    .attr("font-size", y_axis_label_font_size)
                    .text("min " + track_statistics.min_samples_in_location);

                axis.append("svg:text")
                    .attr("x", type_label_x)
                    .attr("y", type_label_y)
                    .text(scale_type_label);

                axis.append("svg:text")
                    .attr("x", 0)
                    // Use the "y" attribute for horizontal positioning, because of the rotation.
                    .attr("y", y_axis_label_x)
                    .attr("transform", "rotate(-90)")
                    .attr("font-size", y_axis_label_font_size)
                    .text("Samples");
            },

            __find_maximum_samples_in_location: function(mutation_data) {
                var track_maximums = [];
                _.each(mutation_data, function(track_obj) {
                    var grouped_data = SeqPeekDataAdapters.group_by_location(track_obj.variants, this.selected_group_by, COORDINATE_FIELD_NAME);
                    SeqPeekDataAdapters.apply_statistics(grouped_data, function() {return 'all';});

                    var max_number_of_samples_in_position = d3.max(grouped_data, function(data_by_location) {
                        return d3.max(data_by_location["types"], function(data_by_type) {
                            return data_by_type.statistics.total;
                        });
                    });

                    track_maximums.push(max_number_of_samples_in_position);
                }, this);

                return d3.max(track_maximums);
            },

            __add_data_track: function(track_obj, seqpeek_builder, track_guid, track_target_svg) {
                var track_type = track_obj.track_type || this.sample_track_type_user_setting;

                var variants = track_obj.variants;
                variants.sort(function(x, y) {
                    return (parseInt(x["chromosome_position"]) - parseInt(y["chromosome_position"]));
                });

                if (track_type == "sample_plot") {
                     return seqpeek_builder.addSamplePlotTrackWithArrayData(variants, track_target_svg, {
                        guid: track_guid,
                        hovercard_content: {
                            "Location": function (d) {
                                return d[COORDINATE_FIELD_NAME];
                            },
                            "Amino Acid Mutation": function (d) {
                                return d[AMINO_ACID_MUTATION_FIELD_NAME];
                            },
                            "Amino Acid Wildtype": function (d) {
                                return d[AMINO_ACID_WILDTYPE_FIELD_NAME];
                            },
                            "DNA change": function (d) {
                                return d[DNA_CHANGE_FIELD_NAME];
                            },
                            "Type": function (d) {
                                return d[TYPE_FIELD_NAME];
                            },
                            "Patient ID": function (d) {
                                return d["patient_id"];
                            },
                            "UniProt ID": function (d) {
                                return d["uniprot_id"];
                            }
                        }
                    }, track_obj.is_summary_track);
                }
                else {
                    return seqpeek_builder.addBarPlotTrackWithArrayData(track_obj.variants, track_target_svg, {
                        guid: track_guid,
                        hovercard_content: {
                            "Location": function (d) {
                                return d["coordinate"];
                            },
                            "Type": function (d) {
                                return d["type"];
                            },
                            "Number": function (d) {
                                return d["statistics"]["total"];
                            }
                        },
                        max_samples_in_location: this.maximum_samples_in_location
                    }, track_obj.is_summary_track);
                }
            },

            __build_regions: function(data, protein_start, protein_end) {
                if (this.current_view_mode == DISPLAY_MODES.PROTEIN) {
                    return this.__build_regions_protein(data, protein_start, protein_end);
                }
                else {
                    return this.__build_regions_genomic(data, protein_start, protein_end);
                }
            },

            __build_regions_protein: function(data, protein_start, protein_end) {
                return [ { "type": "exon", "start": 0, "end": protein_end } ];
            },

            __build_regions_genomic: function(data, protein_start, protein_end) {
                var itercount = 0;

                data.sort(function(x, y) {
                    return (parseInt(x["chromosome_position"]) - parseInt(y["chromosome_position"]));
                });

                var split = _.reduce(data, function(memo, data_point, index, input_array) {
                    itercount += 1;
                    var has_uniprot = _.has(data_point, "uniprot_id");

                    if (memo.last_has_uniprot === null) {
                        memo.current_array.push(data_point);
                        memo.last_has_uniprot = has_uniprot;
                        return memo;
                    }

                    if (has_uniprot != memo.last_has_uniprot) {
                        memo.split_array.push({
                            coding: memo.last_has_uniprot,
                            data: _.clone(memo.current_array)
                        });

                        memo.current_array = [data_point];
                    }
                    else {
                        memo.current_array.push(data_point);
                    }

                    memo.last_has_uniprot = has_uniprot;

                    return memo;

                }, {
                    current_array: [],
                    split_array: [],
                    last_has_uniprot: null
                });

                var get_first_start_coord = function(item) {
                    return parseInt(_.first(item["data"])["chromosome_position"]);
                };

                var region_info = _.reduce(split.split_array, function(memo, split_item, index, data_array) {
                    var data = split_item.data;
                    var first = _.first(data);
                    var last = _.last(data);

                    var region;

                    var start_coord = get_first_start_coord(split_item);

                    var end_coord = parseInt(last["chromosome_position"]);

                    if (split_item.coding) {
                        region = {
                            type: "exon",
                            start: start_coord,
                            end: end_coord,
                            start_aa: parseInt(first["amino_acid_position"]),
                            end_aa: parseInt(last["amino_acid_position"])
                        };
                    }
                    else {
                        region = {
                            type: "noncoding",
                            start: index == 0 ? start_coord : memo.previous_end_coord + 1,
                            end: index == (data_array.length - 1) ? end_coord : (get_first_start_coord(data_array[index+1]) - 0)
                        };
                    }

                    memo.previous_end_coord = end_coord;

                    memo.data.push(region);

                    return memo;

                }, {
                    previous_end_coord: null,
                    data: [],
                    x_position: 0
                });

                return region_info.data;
            },

            __preprocess_data_and_render: function() {
                _.each(this.model["mutations"]["by_tumor_type"], function(model, tumor_type) {
                    var data = model.toJSON()["items"];
                    if (_.isArray(data)) {
                        _.each(data, function(d) {
                            d[COORDINATE_FIELD_NAME] = parseInt(d[COORDINATE_FIELD_NAME]);

                            if (_.has(d, UNIPROT_FIELD_NAME)) {
                                d[AMINO_ACID_POSITION_FIELD_NAME] = parseInt(d[AMINO_ACID_POSITION_FIELD_NAME]);
                            }
                        });
                    }
                }, this);

                if (this.current_view_mode == DISPLAY_MODES.PROTEIN) {
                    this.__load_protein_domains();
                }
                else {
                    this.__render();
                }
            },

            __filter_data: function(data_by_tumor_type) {
                console.debug("seqpeek/view.__filter_data:" + this.selected_gene);

                var filtered = {};

                // Filter out rows that do not have the amino acid position field present,
                // as drawing variants based on chromosome coordinates is not currently supported.
                _.each(this.model["mutations"]["by_tumor_type"], function(model, tumor_type) {
                    var data = model.get("items");
                    if (this.current_view_mode == DISPLAY_MODES.PROTEIN) {
                        filtered[tumor_type] = this.__filter_mutation_data_for_protein_view(data);
                    }
                    else {
                        filtered[tumor_type] = this.__filter_mutation_data_for_genomic_view(data)
                    }
                }, this);
                return filtered;
            },

            __filter_mutation_data_for_protein_view: function(data) {
                var lowercase_gene = this.selected_gene.toLowerCase();

                return _.filter(data, function(item) {
                    return (_.has(item, UNIPROT_FIELD_NAME) && _.has(item, "gene") && _.isEqual(item["gene"].toLowerCase(), lowercase_gene));
                }, this);
            },

            __filter_mutation_data_for_genomic_view: function(data) {
                return data;
            },

            __filter_mutsig_data: function(data_by_tumor_type) {
                console.debug("seqpeek/view.__filter_mutsig_data:" + this.selected_gene);

                var lowercase_gene = this.selected_gene.toLowerCase();
                var filtered = {};

                _.each(data_by_tumor_type, function(data, tumor_type) {
                    if (_.isArray(data)) {
                        filtered[tumor_type] = _.filter(data, function(item) {
                            return (_.has(item, "gene") && _.isEqual(item["gene"].toLowerCase(), lowercase_gene))
                        }, this);
                    } else {
                        if (_.has(data, "gene") && _.isEqual(data["gene"], lowercase_gene)) {
                            filtered[tumor_type] = data;
                        }
                    }
                });
                return filtered;
            },

            __create_data_for_summary_track: function(mutation_data) {
                var all_variants = [];

                _.each(mutation_data, function(track_obj) {
                    Array.prototype.push.apply(all_variants, track_obj.variants);
                }, this);

                return {
                    variants: all_variants,
                    tumor_type: "COMBINED",
                    track_type: "bar_plot",
                    is_summary_track: true,
                    y_axis_type: "log2"
                };
            },

            __parse_mutsig: function () {
                return _.reduce(this.model["mutsig"].get("items"), function (memo, feature) {
                    if (!_.has(memo, feature.cancer.toLowerCase())) {
                        memo[feature.cancer] = [];
                    }
                    memo[feature.cancer].push(feature);
                    return memo;
                }, {});
            },

            __load_protein_domains: function() {
                this.gene_to_uniprot_mapping = this.__find_protein_identifiers();
                var protein_ids = _.values(this.gene_to_uniprot_mapping);

                var protein_domain_model = new ProteinDomainModel({}, {
                    data_source: {
                        uri: this.options.protein_domains
                    }
                });

                protein_domain_model.on("change", function(changed) {
                    this.found_protein_domains = changed.toJSON();
                    this.__render();
                }, this);

                protein_domain_model.fetch({
                    protein_ids: protein_ids,
                    error: function(xhr, textStatus, errorThrown){
                        console.log([xhr, textStatus, errorThrown]);
                    }
                });
            },

            __find_protein_identifiers: function() {
                var items = _.flatten(_.map(this.model["mutations"]["by_tumor_type"], function(model, tumor_type) {
                    return model.get("items");
                }));

                var gene_to_uniprot_mapping = _.reduce(items, function(memo, item) {
                    var gene_label = item["gene"];
                    if (!_.has(memo, gene_label) && _.has(item, UNIPROT_FIELD_NAME)) {
                        memo[gene_label] = item[UNIPROT_FIELD_NAME];

                    }
                    return memo;
                }, {});

                return gene_to_uniprot_mapping;
            },

            __filter_protein_domain_matches: function(match_array, dbname) {
                return _.filter(match_array, function(match) {
                    return match["dbname"] == dbname;
                });
            },

            __enable_seqpeek_zoom: function() {
                this.seqpeek.toggleZoomMode();
            },

            __enable_seqpeek_selection: function() {
                this.seqpeek.toggleSelectionMode();
            },

            __seqpeek_selection_handler: function(id_list) {
                this.selected_patient_ids = id_list;

                this.__update_sample_list_dropdown();
            },

            __update_sample_list_dropdown: function() {
                var num_selected = this.selected_patient_ids.length;
                var caption;

                if (num_selected == 0 || num_selected > 1) {
                    caption = num_selected + " Samples Selected";
                }
                else {
                    caption = "1 Sample Selected";
                }

                this.$el.find(".sample-list-dropdown").html(SampleListCaptionTpl({
                    caption: caption
                }));
            },

            __sample_list_union: function(target_list_model) {
                if (this.selected_patient_ids.length > 0) {
                    this.samplelists.updateSampleListByUnion(target_list_model["id"], this.selected_patient_ids);
                }
            },

            __store_sample_list: function() {
                var list_label = this.$el.find(".new-list-name").val();

                if (list_label.length == 0 || this.selected_patient_ids.length == 0) {
                    return;
                }

                this.$el.find(".new-list-name").val("");

                this.samplelists.addSampleList(list_label, this.selected_patient_ids);
            },

            __update_scaling_button_label: function() {
                var label;
                if (this.sample_track_type_user_setting == "bar_plot") {
                    label = "Use linear scale";
                }
                else {
                    label = "Use log2 scale";
                }

                this.$(".btn.seqpeek-toggle-bars").text(label);
            },

            __update_sample_highlight_button_label: function() {
                var label;

                if (this.sample_highlight_mode == SAMPLE_HIGHLIGHT_MODES.ALL) {
                    label = "Enable highlight";
                }
                else {
                    label = "Disable highlight";
                }

                this.$(".btn.seqpeek-samplelist-highlight").text(label);

                console.log(this.samplelists);
            }
        });
    });
