!function ($) {
    var SeqPeekPrototype = {
        mutationSortFn: function(a, b) {
            var subtype_order = _
                .chain(this.data.tracks)
                .pluck('label')
                .reduce(function(memo, label, index) {
                    memo[label] = index;
                    return memo;
                }, {})
                .value();

            var mutation_order = _
                .chain(this.config.mutation_order)
                .reduce(function(memo, label, index) {
                    memo[label] = index;
                    return memo;
                }, {})
                .value();

            if (!_.has(mutation_order, a.mutation_type) || !_.has(mutation_order, b.mutation_type)) {
                return 0;
            }

            if( mutation_order[a.mutation_type] < mutation_order[b.mutation_type]) {
                return -1;
            }
            else if( mutation_order[a.mutation_type] > mutation_order[b.mutation_type]) {
                return 1;
            }
            else {
                if (subtype_order[a.cancer_subtype] < subtype_order[b.cancer_subtype]) {
                    return -1;
                }
                else if (subtype_order[a.cancer_subtype] > subtype_order[b.cancer_subtype]) {
                    return 1;
                }
                else {
                    return 0;
                }
            }
        },

        mutationIdFn: function(d) {
            return d.mutation_id;
        },

        getMutationLabelRows: function(d) {
            return _
                .chain(this.config.mutation_label_rows)
                .map(function(f) {
                    return f.label + " - " + d[f.name];
                })
                .value();
        },

        processData: function() {
            var that = this;
            var data = this.data;

            var samplesColorBy = function(d, color_by, track) {
                if (!_.has(d, 'processed_samples')) {
                    d.processed_samples = {
                        color_by: {}
                    };
                }

                var createFractionalColorByBars = function(color_by, samples_by_categories) {
                    var total_samples = _.reduce(samples_by_categories, function(memo, value, key) {
                        return memo + value;
                    }, 0);

                    return _.reduce(color_by.group_names, function(memo, group_name) {
                        if (_.has(samples_by_categories, group_name)) {
                            var number = samples_by_categories[group_name],
                                fract = number / total_samples,
                                height = fract * color_by.max_height;

                            memo.array.push({
                                height: height,
                                color: color_scale(group_name),
                                y: memo.current_y
                            });

                            memo.current_y += height;
                        }

                        return memo;
                    }, {
                        array: [],
                        current_y: 0
                    });
                };

                var createStackedLogColorByBars = function(color_by, samples_by_categories) {
                    var category_max_height = color_by.max_height / _.keys(samples_by_categories).length,
                        total_samples = _.reduce(samples_by_categories, function(memo, value, key) {
                            return memo + value;
                        }, 0);

                    var log_scale = d3.scale
                        .log()
                        .domain([1.0, total_samples])
                        .range([5, color_by.max_height]);

                    var bars = _.reduce(color_by.group_names, function(memo, group_name) {
                        if (_.has(samples_by_categories, group_name)) {
                            var number = grouped[group_name],
                                height = d3.max([1.0, category_max_height * (number / total_samples)]);

                            if (number > 0) {
                                memo.array.push({
                                    height: height,
                                    color: color_by.color_scale(group_name),
                                    y: memo.current_y
                                });

                                memo.current_y += height;
                            }
                        }

                        return memo;
                    }, {
                        array: [],
                        current_y: 0
                    });

                    var total_height = log_scale(bars.current_y),
                        k = total_height / bars.current_y;

                    return _.reduce(bars.array, function(memo, bar) {
                        var height = k * bar.height;

                        memo.array.push({
                            height: height,
                            color: bar.color,
                            y: memo.current_y
                        });

                        memo.current_y += height;

                        return memo;
                    },{
                        array: [],
                        current_y: 0
                    });
                };

                var createStackedLogAggregateColorByBars = function(color_by, samples_by_categories, track_data) {
                    var total_samples = track_data.data.max_samples;

                    var log_scale = d3.scale
                        .log()
                        .domain([1.0, total_samples])
                        .range([5, color_by.max_height]);

                    var bars = _.reduce(color_by.group_names, function(memo, group_name) {
                        if (_.has(samples_by_categories, group_name)) {
                            var number = grouped[group_name],
                                //height = d3.max([1.0, category_max_height * (number / total_samples)]);
                                height = log_scale(number);

                            if (number > 0) {
                                memo.array.push({
                                    height: height,
                                    color: color_by.color_scale(group_name),
                                    y: memo.current_y
                                });

                                memo.current_y += height;
                            }
                        }

                        return memo;
                    }, {
                        array: [],
                        current_y: 0
                    });

                    return bars;
                };

                var createStackedNormalizedLogColorByBars = function(color_by, samples_by_categories) {
                    var category_sizes = color_by.category_sizes,
                        category_max_height = color_by.max_height / _.keys(category_sizes).length;

                    var log_scale = d3.scale
                        .log()
                        .domain([1.0, color_by.category_sum])
                        .range([5, color_by.max_height]);

                    var bars = _.reduce(color_by.group_names, function(memo, group_name) {
                        if (_.has(samples_by_categories, group_name)) {
                            var number = grouped[group_name],
                                cat_size = category_sizes[group_name],
                                height = d3.max([1.0, category_max_height * (number / cat_size)]);

                            if (number > 0) {
                                memo.array.push({
                                    height: height,
                                    color: color_by.color_scale(group_name),
                                    y: memo.current_y
                                });

                                memo.current_y += height;
                            }
                        }

                        return memo;
                    }, {
                        array: [],
                        current_y: 0
                    });

                    var total_height = log_scale(bars.current_y),
                        k = total_height / bars.current_y;

                    return _.reduce(bars.array, function(memo, bar) {
                        var height = k * bar.height;

                        memo.array.push({
                            height: height,
                            color: bar.color,
                            y: memo.current_y
                        });

                        memo.current_y += height;

                        return memo;
                    },{
                        array: [],
                        current_y: 0
                    });
                };

                var grouped,
                    bar_data;

                if (_.isFunction(color_by.group_fn)) {
                    grouped = color_by.group_fn(d.sample_ids, d);
                }
                else {
                    grouped = _.countBy(d.sample_ids, function(s) {
                        return s.value;
                    });
                }

                if (color_by.type == 'fract') {
                    bar_data = createFractionalColorByBars(color_by, grouped);
                }
                else if (color_by.type == 'log10n') {
                    bar_data = createStackedLogColorByBars(color_by, grouped);
                }
                else if (color_by.type == 'log10naggr') {
                     bar_data = createStackedLogAggregateColorByBars(color_by, grouped, track);
                 }
                else if (color_by.type == 'log10nnorm') {
                    bar_data = createStackedNormalizedLogColorByBars(color_by, grouped);
                }
                else {
                    console.error('Invalid color_by type \'' + color_by.type + '\'');
                }

                var data_obj = _.clone(color_by);
                data_obj.bar_data = bar_data.array;
                data_obj.category_counts = grouped;
                d.processed_samples.color_by.color_by = data_obj;
            };

            var processSamples = function(entries) {
                var mutation_data = _.extend({}, entries[0], {}),
                    id_field = that.config.mutation_sample_id_field;

                mutation_data.sample_ids = _.map(entries, function(e) {
                    return {
                        id: e[id_field],
                        value: e.value
                    };
                });

                mutation_data[id_field] = null;

                return mutation_data;
            };

            data.subtype_to_index_map = {};


            _.each(data.tracks, function(track, index) {
                data.subtype_to_index_map[track.label] = index;

                if (! _.has(track, 'mutations_by_loc') && ! _.has(track, 'mutations_processed')) {
                    var mutations_by_loc = _
                        .chain(track.mutations)
                        .groupBy('mutation_id')
                        .map(processSamples)
                        .groupBy('location')
                        .value();

                    if (track.type == 'samples') {
                        // If 'Color By' functionality is enabled, calculate needed statistics
                        if (_.has(track, 'color_by') && track.color_by.type != 'none') {
                            _.each(mutations_by_loc, function(mutations, location) {
                                _.each(mutations, function(m) {
                                    samplesColorBy(m, track.color_by, track);
                                });
                            });
                        }
                    }
                    else if (track.type == 'location') {
                        // If 'Color By' functionality is enabled, calculate needed statistics
                        if (_.has(track, 'color_by') && track.color_by.type != 'none') {
                            _.each(mutations_by_loc, function(mutations, location) {
                                _.each(mutations, function(m) {
                                    samplesColorBy(m, track.color_by, track);
                                });
                            });
                        }
                    }
                    else {
                        console.error('Invalid track type \'' + track.type + '\'');
                    }

                    // Create flat array of all mutations
                    var all_mutations = [];

                    _.each(mutations_by_loc, function(mutations, location) {
                        all_mutations.push.apply(all_mutations, mutations);
                    });

                    track.mutations_by_loc = mutations_by_loc;
                    track.mutations_processed = all_mutations;
                }

                var default_layout = {
                    background_ticks: {
                        y1: 0,
                        y2: 0
                    },
                    mutation_stems: {
                        enabled: false
                    },
                    mutations: {
                        y: 0
                    },
                    protein_scale_line: {
                        enabled: true,
                        y: 0
                    },
                    protein_scale_ticks: {
                        enabled: true,
                        y: 0
                    },
                    protein_domains: {
                        enabled: true,
                        y: 0
                    },
                    y: 0
                };

                track.layout = _.extend(default_layout, track.layout);

                track.tooltips.location.hovercard = vq.hovercard({
                    canvas_id: that.config.guid,
                    include_header: false,
                    include_footer: true,
                    self_hover: true,
                    timeout: 200,
                    data_config: track.tooltips.location.items,
                    tool_config: []
                });
            });

            data.all_mutations_by_loc = _
                .chain(data.tracks)
                .pluck('mutations_by_loc')
                .reduce(function(memo, locations, index) {
                    _.each(locations, function(data, loc) {
                        if (!_.has(memo, loc)) {
                            memo[loc] = data.slice(0);
                        }
                        else {
                            // Concatenate the array 'data' to memo[loc}
                            memo[loc].push.apply(memo[loc], data.slice(0));
                        }
                    });
                    return memo;
                }, {})
                .value();
        },

        doSubtypeLayout: function(track, config, param_layout) {
            var that = this;
            var layout = param_layout || _.extend({}, track.layout);

            // TODO Make this dependent on label font size
            var label_offset = 7.0;

            var mutations_height = 0;

            var stackedSamplesHeightFn = function(mutations_processed) {
                return d3.max(mutations_processed, function(m) {
                    return m.sample_ids.length * config.mutation_shape_width;
                });
            };

            var colorByBarsSamplesHeightFn = function(mutations_processed) {
                return d3.max(mutations_processed, function(m) {
                    return _.reduce(m.processed_samples.color_by.color_by.bar_data,
                        function(total, d) {
                            return total + d.height;
                        }, 0);
                });
            };

            // Resolve the maximum height of the mutation shape stack including stems if needed
            if (track.type == 'samples') {
                if (_.has(track, 'color_by')) {
                    mutations_height = colorByBarsSamplesHeightFn(track.mutations_processed);
                }
                else {
                    mutations_height = stackedSamplesHeightFn(track.mutations_processed);
                }
            }
            else {
                return 150;
            }

            if (track.layout.mutation_stems.enabled === true) {
                mutations_height = mutations_height + config.mutation_groups.stems.height;
            }

            // Height of scale line if displayed
            var protein_scale_height = 0;
            if (layout.protein_scale_ticks.enabled === true) {
                protein_scale_height = config.location_tick_height;
            }

            // Height of protein domains in total if displayed
            var domains_height = 0;

            if (layout.protein_domains.enabled === true) {
                domains_height = that.vis.domain_scale.rangeExtent()[1] + that.config.protein_domains.padding;
            }

            layout.mutations.y = mutations_height;
            layout.protein_scale_line.y = layout.mutations.y;

            // If stems are not drawn, move the scale line down so that it will not overlap with the mutation shapes
            if (track.layout.mutation_stems.enabled === false) {
                layout.protein_scale_line.y += config.mutation_shape_width / 2.0;
            }

            layout.protein_scale_ticks.y = layout.protein_scale_line.y + protein_scale_height;

            layout.protein_domains.y = layout.protein_scale_ticks.y + domains_height;

            layout.height = mutations_height + protein_scale_height + domains_height;

            layout.label_y = mutations_height / 2.0 + label_offset;

            layout.background_ticks.y1 = -mutations_height;
            layout.background_ticks.y2 = 0;

            if (layout.protein_domains.enabled === false) {
                layout.background_ticks.y2 = layout.protein_scale_ticks.enabled ? (config.location_tick_height / 2.0) : config.mutation_shape_width / 2.0;
            }

            return layout;
        },

        updateVerticalScaleRanges: function() {
            var that = this;
            var data = this.data;

            var current_y = 0;

            _.each(data.tracks, function(subtype) {
                var layout = that.doSubtypeLayout(subtype, that.config);

                layout.y = current_y;
                _.extend(subtype.layout, layout);

                current_y = current_y + layout.height;

                if (layout.protein_domains.enabled === false ||
                    layout.protein_scale_ticks.enabled === false) {
                    current_y = current_y + 5.0;
                }
            });
        },

        getMaxVisualizationSize: function() {
            var that = this;
            var data = this.data;

            // Resolve the maximum total height of the tracks, assuming that the protein scale
            // and protein domains are displayed for every subtype.
            var max_height = 0;

            var test_layout = {
                background_ticks: {
                    y1: 0,
                    y2: 0
                },
                mutations: {
                    y: 0
                },
                protein_scale_line: {
                    enabled: true,
                    y: 0
                },
                protein_scale_ticks: {
                    enabled: true,
                    y: 0
                },
                protein_domains: {
                    enabled: true,
                    y: 0
                },
                y: 0
            };


            // TODO fix
            var test_config = _.extend({}, that.config, {
                enable_mutation_stems: true
            });

            _.each(data.tracks, function(subtype) {
                var layout = that.doSubtypeLayout(subtype, test_config, test_layout);

                // TODO
                max_height += (layout.height + that.config.protein_scale.vertical_padding);
            });

            return {
                width: this.config.band_label_width + this.config.protein_scale.width,
                height: max_height
            };
        },

        getDefaultVisualizationSize: function() {
            var that = this;
            var data = this.data,
                layout;

            // Resolve the maximum total height of the tracks, assuming that the protein scale
            // and protein domains are displayed only on the last subtype.
            var max_height = 0;

            var default_layout = {
                background_ticks: {
                    y1: 0,
                    y2: 0
                },
                mutations: {
                    y: 0
                },
                protein_scale_line: {
                    enabled: false,
                    y: 0
                },
                protein_scale_ticks: {
                    enabled: false,
                    y: 0
                },
                protein_domains: {
                    enabled: false,
                    y: 0
                },
                y: 0
            };

            var last_layout = {
                background_ticks: {
                    y1: 0,
                    y2: 0
                },
                mutations: {
                    y: 0
                },
                protein_scale_line: {
                    enabled: true,
                    y: 0
                },
                protein_scale_ticks: {
                    enabled: true,
                    y: 0
                },
                protein_domains: {
                    enabled: true,
                    y: 0
                },
                y: 0
            };


            // TODO fix
            var test_config = _.extend({}, that.config, {
                enable_mutation_stems: true
            });

            // Add height of all but the last cancer
            _.chain(data.tracks)
                .initial()
                .each(function(track) {
                    layout = that.doSubtypeLayout(track, test_config, default_layout);
                    // TODO
                    // Size of the data-area element becomes correct, but the vertical padding
                    // is not actually applied to be present between the tracks.
                    max_height += (layout.height + that.config.protein_scale.vertical_padding);
                });

            // Add height of the last cancer
            layout = that.doSubtypeLayout(_.last(data.tracks), test_config, last_layout);
            max_height += layout.height;

            return {
                width: this.config.band_label_width + this.config.protein_scale.width,
                height: max_height
            };
        },

        getSize: function() {
            return {
                width: this.vis.size_info.width + 2.0 * this.config.plot.horizontal_padding,
                height: this.vis.size_info.height + 2.0 * this.config.plot.vertical_padding
            }
        },

        draw: function(data, param_config) {
            var that = this;
            this.config.target_el.innerHTML = "";
            this.data = data;

            _.extend(this.config, param_config);

            this.processData();
            this.vis = {
                refs: {
                    labels: {},
                    panel: {},
                    symbols: {}
                }
            };

            // Linear scale for location in protein
            this.vis.ref_scale = d3.scale.linear().domain([0, data.protein.length]).range([0, this.config.protein_scale.width]);

            // Ordinal scale for vertically positioning InterPro signatures
            var protein_domain_ids = _.uniq(_.pluck(data.protein.domains, this.config.protein_domains.key));
            this.vis.domain_scale = d3.scale.ordinal().domain(protein_domain_ids).rangeBands([0, protein_domain_ids.length * this.config.signature_height]);

            //this.updateVerticalScaleRanges();

            var size_info = this.getDefaultVisualizationSize();
            this.updateVerticalScaleRanges();

            this.vis.size_info = size_info;

            this.vis.viewport_size = [this.config.protein_scale.width, size_info.height];
            this.vis.viewport_scale = [1, 1];
            this.vis.viewport_pos = [0, 0];

            // Align mutations and calculate screen locations, then
            // set viewport such that all mutations are visible initially.
            this.alignMutations();
            this.updateMutationLayout(this.vis.ref_scale);
            this.setInitialViewport();

            this.vis.zoom = d3.behavior.zoom()
                .translate(this.vis.viewport_pos)
                .scale(this.vis.viewport_scale[0])
                .on("zoom", function() {
                    _.bind(that.zoomEventHandler, that, {}, true)();
                });

            this.vis.root = d3.select(this.config.target_el)
                .append("svg")
                    .attr("id", this.config.guid)
                    .attr("width", (2 * this.config.plot.horizontal_padding + size_info.width))
                    .attr("height", (2 * this.config.plot.vertical_padding + size_info.height))
                    .style("pointer-events", "none");

            // Area for labels
            this.vis.root
                .append("g")
                    .attr("class", "label-area")
                    .attr("width", this.config.band_label_width)
                    .attr("height", size_info.height)
                    .attr("transform", "translate(" + this.config.plot.horizontal_padding + "," + this.config.plot.vertical_padding + ")")
                    .style("pointer-events", "all");

            // Area for scale lines, reference lines and tick marks
            this.vis.root
                .append("g")
                    .attr("class", "panel-area")
                    .attr("x", 0.0)
                    .attr("y", 0.0)
                    .attr("width", this.vis.viewport_size[0])
                    .attr("height", this.vis.viewport_size[1])
                    .attr("transform", "translate(" + (this.config.plot.horizontal_padding + this.config.band_label_width) + "," + this.config.plot.vertical_padding + ")")
                    .style("pointer-events", "none");

            // Area for graphical elements with clipping
            this.vis.root
                .append("svg:svg")
                    .attr("class", "data-area")
                    .attr("x", (this.config.plot.horizontal_padding + this.config.band_label_width))
                    .attr("y", (this.config.plot.vertical_padding))
                    .attr("width", this.vis.viewport_size[0])
                    .attr("height", this.vis.viewport_size[1])
                    .style("pointer-events", "all");

            // Rectangle for mouse events
            this.vis.root
                .selectAll(".data-area")
                .append("svg:rect")
                    .attr("class", "zoom-rect")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", this.vis.viewport_size[0])
                    .attr("height", this.vis.viewport_size[1])
                    .style("fill-opacity", 0.0)
                .call(this.vis.zoom);

            // Calculate scale factor for protein domains to 100% viewport
            var domain = this.vis.ref_scale.domain();
            this.vis.domain_rect_scale_factor = this.config.protein_scale.width / (domain[1] - domain[0]);

            this.tooltips = {
                interpro: hovercard = vq.hovercard({
                    canvas_id: this.config.guid,
                    include_header: false,
                    include_footer: true,
                    self_hover: true,
                    timeout: 200,
                    data_config: that.config.tooltips.interpro.items,
                    tool_config: []
                })
            };

            this.render();
        },

        zoomEventHandler: function() {
            var e = d3.event;

            this.vis.viewport_scale = [e.scale, 0.0];
            this.vis.viewport_pos = e.translate;

            this.applyViewportChange();
        },

        setInitialViewport: function() {
            // Find maximum extent
            var left = d3.min(this.data.tracks, function(d) {
                return d.mutation_layout.extent.left;
            });
            var right = d3.max(this.data.tracks, function(d) {
                return d.mutation_layout.extent.right;
            });

            var x_translate = Math.abs(d3.min([left, 0.0]));

            var viewport_width = x_translate + d3.max([this.config.protein_scale.width, right]);

            this.vis.viewport_pos = [
                x_translate,
                0.0
            ];

            this.vis.viewport_scale = [
                this.config.protein_scale.width / viewport_width,
                0.0
            ];
        },

        changeTracks: function(new_tracks, config) {
            var data = this.data,
                order = config.subtype_order;

            // Filter out tracks that might already be in the visualization
            _.chain(new_tracks)
                .filter(function(s) {
                    return _.has(data.subtype_to_index_map, s.label) === false;
                })
                .each(function(s) {
                    data.tracks.push(s);
                });

            // Remove tracks that are not included in the 'order' array
            data.tracks = _.filter(data.tracks, function(s) {
                return order.indexOf(s.label) != -1;
            });

            data.tracks = data.tracks.sort(function(a, b) {
                if (order.indexOf(a.label) < order.indexOf(b.label)) {
                    return -1;
                }
                else if (order.indexOf(a.label) == order.indexOf(b.label)) {
                    return 0;
                }
                else {
                    return 1;
                }
            });

            if (_.isFunction(config.post_process_fn)) {
                config.post_process_fn(data.tracks);
            }

            // Do data mangling for new tracks
            this.processData();

            // Do layouts for new tracks
            this.updateVerticalScaleRanges();

            this.render();
        },

        render: function() {
            var that = this;
            var data = this.data;

            // --------
            // Graphics
            // --------
            var track_content_g = this.vis.root
                .selectAll(".data-area")
                .selectAll("g.seqpeek-track")
                    .data(data.tracks, function(d) {
                        return d.label;
                    });

            var tracks_enter = track_content_g.enter();
            var tracks_exit = track_content_g.exit();

            var track = tracks_enter
                .append("g")
                    .attr("class", "seqpeek-track")
                    .attr("height", function(d) {
                        return d.layout.subtype_height;
                    })
                    .attr("transform", function(d) {
                        return "translate(0," + d.layout.y + ")";
                    })
                    .style("opacity", 1e-6);

            track
                .append("g")
                    .attr("class", "protein")
                    .attr("transform", "translate(0,0)");

            if (that.config.enable_transitions) {
                track_content_g = track_content_g
                    .transition()
                    .duration(500);

                tracks_exit = tracks_exit
                    .transition()
                    .duration(500)
                    .style("opacity", 1e-6);
            }

            // Update
            track_content_g
                .attr("height", function(d) {
                    return d.layout.subtype_height;
                })
                .attr("transform", function(d) {
                    return "translate(0," + d.layout.y + ")";
                })
                .style("opacity", 1.0);

            // Exit
            tracks_exit
                .remove();

            this.vis.refs.symbols.protein = this.vis.root.selectAll(".data-area g.protein");

            // ------
            // Labels
            // ------
            track_content_g = this.vis.root
                .selectAll("g.label-area")
                .selectAll("g.seqpeek-track")
                    .data(data.tracks, function(d) {
                        return d.label;
                    });

            tracks_enter = track_content_g.enter();
            tracks_exit = track_content_g.exit();

            track = tracks_enter
                .append("g")
                    .attr("class", "seqpeek-track")
                    .attr("height", function(d) {
                        return d.layout.subtype_height;
                    })
                    .attr("transform", function(d) {
                        return "translate(0," + d.layout.y + ")";
                    })
                    .style("opacity", 1e-6);

            track
                .append("text")
                    .attr("left", 0)
                    .attr("y", function(d) {
                        return d.layout.label_y;
                    })
                    .text(function(d) {
                        return d.label;
                    });

            if (that.config.enable_transitions) {
                track_content_g = track_content_g
                    .transition()
                    .duration(500);

                tracks_exit = tracks_exit
                    .transition()
                    .duration(500)
                    .style("opacity", 1e-6);
            }

            // Update
            track_content_g
                .attr("height", function(d) {
                    return d.layout.subtype_height;
                })
                .attr("transform", function(d) {
                    return "translate(0," + d.layout.y + ")";
                })
                .style("opacity", 1.0);

            // Exit
            tracks_exit
                .remove();

            // -----
            // Panel
            // -----
            track_content_g = this.vis.root
                .selectAll("g.panel-area")
                .selectAll("g.seqpeek-track")
                    .data(data.tracks, function(d) {
                        return d.label;
                    });

            tracks_enter = track_content_g.enter();
            tracks_exit = track_content_g.exit();

            track = tracks_enter
                .append("g")
                    .attr("class", "seqpeek-track")
                    .attr("height", function(d) {
                        return d.layout.subtype_height;
                    })
                    .attr("transform", function(d) {
                        return "translate(0," + d.layout.y + ")";
                    })
                    .style("opacity", 1e-6);

            track
                .append("g")
                    .attr("class", "protein")
                    .attr("transform", "translate(0,0)")
                // Vertical reference lines on the protein scale
                .append("g")
                    .attr("class", "background-ticks")
                    .attr("transform", function(d) {
                        return "translate(0," + (d.layout.mutations.y) + ")";
                    });

            if (that.config.enable_transitions) {
                track_content_g = track_content_g
                    .transition()
                    .duration(500);

                tracks_exit = tracks_exit
                    .transition()
                    .duration(500)
                    .style("opacity", 1e-6);
            }

            // Update
            track_content_g
                .attr("height", function(d) {
                    return d.layout.subtype_height;
                })
                .attr("transform", function(d) {
                    return "translate(0," + d.layout.y + ")";
                })
                .style("opacity", 1.0);

            // Exit
            tracks_exit
                .remove();

            this.vis.refs.panel.protein = this.vis.root.selectAll(".panel-area g.protein");

            this.applyLayoutChange();
        },

        updateTrackPositions: function() {
            this.vis.root
                .selectAll(".data-area")
                .selectAll("g.seqpeek-track")
                    .transition()
                    .duration(500)
                    .attr("height", function(d) {
                        return d.layout.subtype_height;
                    })
                    .attr("transform", function(d) {
                        return "translate(0," + d.layout.y + ")";
                    });
        },

        applyLayoutChange: function() {
            this.updateTickScale();

            this.applyDataElements();
            this.applyPanelElements();

            this.applyReferenceLines();
            this.applyProteinScales();
            this.applyProteinDomains();

            this.applyMutationGroups();
            this.applyMutationMarkers();

            this.applyStems();
        },

        applyViewportChange: function() {
            this.updateTickScale();

            this.updateReferenceLines();
            this.updateProteinScaleTicks();
            this.updateProteinDomains();
            this.updateMutationMarkers();
        },


        applyMutationGroups: function() {
            var that = this;
            var data = this.data;

            var tracks = this.vis.root
                .selectAll(".data-area")
                .selectAll("g.seqpeek-track");

            tracks
                .each(function(track_data) {
                    var mutation_group = d3
                        .select(this)
                        .selectAll(".protein")
                        .selectAll("g.mutations")
                            .data(function(d) {
                                return [d];
                            }, function(d) {
                                return d.label;
                            });

                    mutation_group
                        .enter()
                        .append("g")
                            .attr("class", "mutations")
                            .style("opacity", 1e-6);

                    mutation_group
                        .attr("transform", function(d) {
                            // Transform:
                            //
                            // 1. translate (<viewport x>, <mutations placement y>)
                            // 2. scale (<viewport x scale>, -1)
                            var trs =
                                "translate(" + (that.vis.viewport_pos[0]) + "," + (d.layout.mutations.y) + ")" +
                                "scale(" + that.vis.viewport_scale[0] + ", -1)";

                            return trs;
                        })
                        .style("opacity", 1.0);
                });
        },

        applyDataElements: function() {
            var that = this;
            var data = this.data;

            var tracks = this.vis.root
                .selectAll(".data-area")
                .selectAll("g.seqpeek-track");

            tracks
                .each(function(track_data) {
                    var domains = d3
                        .select(this)
                        .selectAll(".protein")
                        .selectAll("g.domains")
                            .data(function(d) {
                                return d.layout.protein_domains.enabled === true ? [data.protein.domains] : [];
                            });

                    domains
                        .enter()
                        .append("g")
                            .attr("class", "domains")
                            .attr("transform", function() {
                                // Transform:
                                //
                                // 1. translate (<viewport x>, <domain placement y>)
                                // 2. scale (<domain rectangle to 100% viewport>, 0)
                                // 3. scale (<viewport x scale>, -1)
                                var trs =
                                    "translate(" + (that.vis.viewport_pos[0]) + "," + (track_data.layout.protein_domains.y) + ")" +
                                    "scale(" + that.vis.viewport_scale[0] * that.vis.domain_rect_scale_factor + ", -1)";

                                return trs;
                            })
                            .style("opacity", 1e-6);

                    var domains_exit = domains.exit();

                    if (that.config.enable_transitions) {
                        domains = domains
                            .transition()
                            .duration(500);
                    }

                    domains
                        .style("opacity", 1.0);

                    if (that.config.enable_transitions) {
                        domains_exit = domains_exit
                            .transition()
                            .duration(500)
                            .style("opacity", 1e-6);
                    }

                    domains_exit
                        .remove();
                });
        },

        applyPanelElements: function() {
            var that = this;

            var tracks = this.vis.root
                .selectAll(".panel-area")
                .selectAll("g.seqpeek-track");

            tracks
                .each(function(track_data) {
                    var background_lines = d3
                        .select(this)
                        .selectAll(".protein")
                        .selectAll("g.background-ticks");

                    if (that.config.enable_transitions) {
                        background_lines = background_lines
                            .transition()
                            .duration(500);
                    }

                    background_lines
                        .attr("transform", function(d) {
                            return "translate(0," + (d.layout.mutations.y) + ")";
                        });
                });

            tracks
                .each(function(track_data) {
                    var protein_scales = d3
                        .select(this)
                        .selectAll(".protein")
                        .selectAll("g.scale")
                            .data(function(d) {
                                return (d.layout.protein_scale_ticks.enabled ||
                                    d.layout.protein_scale_line.enabled) === true ? [track_data] : [];
                            });

                    protein_scales
                        .enter()
                        .append("g")
                            .attr("class", "scale")
                            .attr("transform", function() {
                                return "translate(0," + (track_data.layout.protein_scale_ticks.y) + ")";
                            })
                            .style("opacity", 1e-6);

                    var protein_scales_exit = protein_scales.exit();

                    if (that.config.enable_transitions) {
                        protein_scales = protein_scales
                            .transition()
                            .duration(500);
                    }

                    protein_scales
                        .attr("transform", function() {
                            return "translate(0," + (track_data.layout.protein_scale_ticks.y) + ")";
                        })
                        .style("opacity", 1.0);

                    if (that.config.enable_transitions) {
                        protein_scales_exit = protein_scales_exit
                            .transition()
                            .duration(500)
                            .style("opacity", 1e-6);
                    }

                    protein_scales_exit
                        .remove();
                });
        },

        alignMutations: function() {
            var that = this;
            var data = this.data;
            var mutationIdFn = this.mutationIdFn;

            var buildLocationGroups = function(mutations_by_loc) {
                return _
                    .chain(mutations_by_loc)
                    .map(function(mutations, location) {
                        var group,
                            scale = d3.scale.ordinal();

                        mutations.sort(_.bind(that.mutationSortFn, that));

                        var mutation_ids_sorted = _
                            .chain(mutations)
                            .map(mutationIdFn)
                            .uniq()
                            .value();

                        scale.domain(mutation_ids_sorted);
                        scale.rangeBands([0, mutation_ids_sorted.length * that.config.mutation_shape_width]);

                        var width = scale.rangeExtent()[1];

                        group = {
                            data: {
                                // The "location" variable needs to be converted to a numerical type
                                // for the sort below to work correctly.
                                location: parseInt(location, 10),
                                mutations: mutations
                            },
                            scale: scale,
                            left_extent: width / 2.0,
                            right_extent: width / 2.0,
                            start_loc: 0.0,
                            width: width
                        };

                        return group;
                    })
                    .sortBy(function(group) {
                        return group.data.location;
                    })
                    .value();
            };

            var buildLocationGroupsAcrossTracks = _.once(buildLocationGroups);

            _.each(data.tracks, function(track) {
                var layout = {};
                var location_groups;

                if (that.config.mutation_layout === 'by_subtype') {
                    location_groups = buildLocationGroups(track.mutations_by_loc);
                }
                else if (that.config.mutation_layout === 'all_subtypes') {
                    location_groups = buildLocationGroupsAcrossTracks(that.data.all_mutations_by_loc);
                }

                layout.location_groups = location_groups;

                layout.location_to_node_map = _.reduce(location_groups, function(memo, group) {
                    memo[group.data.location] = group;
                    return memo;
                }, {});

                layout.location_to_node_index_map = _.reduce(location_groups, function(memo, group, index) {
                    memo[group.data.location] = index;
                    return memo;
                }, {});

                track.mutation_layout = layout;
            });
        },

        updateMutationLayout: function(param_scale) {
            var layoutFn = function(mutation_data) {
                this.basicMutationLayout(mutation_data, param_scale);
            };

            _.each(this.data.tracks, layoutFn, this);
        },

        basicMutationLayout: function(mutation_data, param_scale) {
            var that = this,
                location_groups = mutation_data.mutation_layout.location_groups,
                location_to_node_map = mutation_data.mutation_layout.location_to_node_map,
                location_to_node_index_map = mutation_data.mutation_layout.location_to_node_index_map;

            var node_locations = _
                .chain(location_to_node_map)
                .keys()
                .map(function(d) {return parseInt(d, 10);})
                .sortBy(function(d) {return d;})
                .value();

            var pivot_location = node_locations[Math.floor(node_locations.length / 2)];

            //var x_scale = that.vis.ref_scale;
            var x_scale = param_scale;

            var pivot_node = location_to_node_map[pivot_location];
            var pivot_index = location_to_node_index_map[pivot_location];

            pivot_node.start_loc = x_scale(pivot_node.data.location) - pivot_node.left_extent;

            // Justify locations right of the pivot
            var group_padding = that.config.mutation_groups.padding;
            var current_loc = pivot_node.start_loc + pivot_node.width + group_padding;

            _.chain(location_groups.slice(pivot_index))
                .rest()
                .each(function(node) {
                    if ((x_scale(node.data.location) - node.left_extent) >= current_loc) {
                        node.start_loc = x_scale(node.data.location) - node.left_extent;
                        current_loc = node.start_loc + node.width + group_padding;
                    }
                    else {
                        node.start_loc = current_loc;
                        current_loc = current_loc + node.width + group_padding;
                    }
                });

            // Justify locations left of the pivot
            current_loc = pivot_node.start_loc - group_padding;

            _.chain(location_groups.slice(0, pivot_index + 1).reverse())
                .rest()
                .each(function(node) {
                    if ((x_scale(node.data.location) + node.right_extent) < current_loc) {
                        node.start_loc = x_scale(node.data.location) - node.left_extent;
                        current_loc = node.start_loc - group_padding;
                    }
                    else {
                        node.start_loc = current_loc - node.width;
                        current_loc = current_loc - node.width - group_padding;
                    }
                });

            mutation_data.mutation_layout.extent = {
                left: _.first(location_groups).start_loc,
                right: function() { return this.start_loc + this.width; }.call(_.last(location_groups))
            };
        },


        updateTickScale: function() {
            var scale = this.vis.viewport_scale[0],
                translate = this.vis.viewport_pos[0],
                x0 = this.vis.ref_scale;

            this.vis.tick_scale =
                d3.scale.linear()
                    .domain((x0.range().map(function(x) { return (x - translate) / scale; }).map(x0.invert)))
                    .range([0, this.config.protein_scale.width]);
        },

        getVisibleTicks: function() {
            var min_x = 0,
                max_x = this.data.protein.length;

            return _.filter(this.vis.tick_scale.ticks(20), function(tick) {
                return tick >= min_x && max_x >= tick;
            });
        },

        applyReferenceLines: function() {
            var that = this;

            this.vis.refs.panel.protein
                .selectAll("g.background-ticks")
                .each(function(subtype_data) {
                    var layout = subtype_data.layout;

                    var background_tick = d3.select(this)
                        .selectAll(".loc-tick")
                            .data(function() {
                                return that.getVisibleTicks();
                            }, String);

                    background_tick
                        .enter()
                        .append("g")
                            .attr("class", "loc-tick")
                            .attr("transform", function(d) {
                                return "translate(" + that.vis.tick_scale(d) + ",0)";
                            })
                        .append("svg:line")
                            .attr("y1", layout.background_ticks.y1)
                            .attr("y2", layout.background_ticks.y2)
                            .style("stroke-width", 1.0)
                            .style("stroke", "#ccc");

                    d3.select(this)
                        .selectAll(".loc-tick line")
                        .transition()
                        .duration(500)
                        .attr("y1", layout.background_ticks.y1)
                        .attr("y2", layout.background_ticks.y2);
            });
    
        },

        updateReferenceLines: function() {
            var that = this,
                x = this.vis.tick_scale;

            this.vis.refs.panel.protein
                .selectAll("g.background-ticks")
                .each(function(track_data) {
                    var layout = track_data.layout;

                    var ref_line = d3.select(this).selectAll(".loc-tick")
                        .data(function() {
                            return that.getVisibleTicks();
                        }, String);

                    ref_line
                        .enter()
                        .append("g")
                            .attr("class", "loc-tick")
                            .attr("transform", function(d) {
                                return "translate(" + x(d) + ",0)";
                            })
                        .append("svg:line")
                            .attr("y1", layout.background_ticks.y1)
                            .attr("y2", layout.background_ticks.y2)
                            .style("stroke-width", 1.0)
                            .style("stroke", "#ccc");

                    ref_line
                        .attr("transform", function(d) {
                            return "translate(" + x(d) + ",0)";
                        });

                    ref_line
                        .exit()
                        .remove();
            });
        },

        updateProteinScaleTicks: function() {
            var that = this,
                x = this.vis.tick_scale;

            this.vis.refs.panel.protein
                .selectAll(".scale")
                .each(function(track_data) {
                    var scale_ticks = d3.select(this)
                        .selectAll(".loc-tick")
                        .data(function(d) {
                            if (d.layout.protein_scale_ticks.enabled === true) {
                                return that.getVisibleTicks();
                            }

                            return [];
                        }, String);

                    scale_ticks
                        .enter()
                        .append("g")
                            .attr("class", "loc-tick")
                            .attr("transform", function(d) {
                                return "translate(" + x(d) + ",0)";
                            })
                        .append("svg:text")
                            .attr("text-anchor", "middle")
                            .attr("y", function() {
                                return 0;
                            })
                            .text(function(d) {
                                return d;
                            });

                    scale_ticks
                        .attr("transform", function(d) {
                            return "translate(" + x(d) + ",0)";
                        });

                    scale_ticks
                        .exit()
                        .remove();
                });
        },

        applyProteinScales: function() {
            var that = this;

            this.vis.refs.panel.protein
                .selectAll(".scale")
                .each(function(track_data) {
                    var scale_line = d3.select(this)
                        .selectAll(".protein-scale")
                            .data(function(d) {
                                if (d.layout.protein_scale_line.enabled === true) {
                                    return [d];
                                }

                            return [];
                        }, function(d) {
                            return d.label;
                        });

                    var scale_line_enter = scale_line.enter();
                    var scale_line_exit = scale_line.exit();

                    scale_line_enter
                        .append("svg:line")
                            .attr("class", "protein-scale")
                            .attr("y1", function(d) { return d.layout.protein_scale_ticks.enabled === true ? -that.config.location_tick_height : 0; })
                            .attr("y2", function(d) { return d.layout.protein_scale_ticks.enabled === true ? -that.config.location_tick_height : 0; })
                            .attr("x1", 0)
                            .attr("x2", that.config.protein_scale.width)
                            .style("stroke", "black")
                            .style("opacity", 1e-6);

                    if (that.config.enable_transitions) {
                        scale_line = scale_line
                            .transition()
                            .duration(500);

                        scale_line_exit = scale_line_exit
                            .transition()
                            .duration(500)
                            .style("opacity", 1e-6);
                    }

                    scale_line
                        .attr("y1", function(d) { return d.layout.protein_scale_ticks.enabled === true ? -that.config.location_tick_height : 0; })
                        .attr("y2", function(d) { return d.layout.protein_scale_ticks.enabled === true ? -that.config.location_tick_height : 0; })
                        .style("opacity", 1.0);

                    scale_line_exit
                        .remove();
            });

            this.updateProteinScaleTicks();
        },

        updateMutationMarkers: function() {
            var that = this;

            this.vis.refs.symbols.protein
                .selectAll(".mutations")
                .each(function() {
                    d3.select(this)
                        .attr("transform", function(d) {
                            // Transform:
                            //
                            // 1. translate (<viewport x>, <mutations placement y>)
                            // 2. scale (<viewport x scale>, -1)
                            var trs =
                                "translate(" + (that.vis.viewport_pos[0]) + "," + (d.layout.mutations.y) + ")" +
                                "scale(" + that.vis.viewport_scale[0] + ", -1)";

                            return trs;
                        });
                });
        },

        applyMutationMarkers: function() {
            var that = this;
            var mutationIdFn = this.mutationIdFn;

            this.vis.refs.symbols.protein
                .selectAll(".mutations")
                .each(function(mutation_data) {
                    var location_to_node_map = mutation_data.mutation_layout.location_to_node_map,
                        location_hovercard = mutation_data.tooltips.location.hovercard,
                        layout = mutation_data.layout;

                    var sampleHoverCardHandler = function(location_data) {
                        var card_config = {};

                        _.each(mutation_data.tooltips.location.items, function(value_fn, key) {
                            card_config[key] = function() {
                                return value_fn(location_data);
                            };

                        });

                        _.each(mutation_data.tooltips.sample.items, function(value_fn, key) {
                            card_config[key] = value_fn;
                        });

                        var samplecard = vq.hovercard({
                            canvas_id: that.config.guid,
                            include_header: false,
                            include_footer: true,
                            self_hover: true,
                            timeout: 200,
                            data_config: card_config,
                            tool_config: []
                        });

                        samplecard.call(this);
                    };

                    var renderCircles = function(type_data) {
                        d3.select(this)
                            .selectAll(".mutation-type.mutation")
                                .data(type_data.sample_ids, function(type_data) {
                                    return type_data.id;
                                })
                                .enter()
                            .append("svg:circle")
                                .attr("r", that.config.mutation_shape_width / 2.0)
                                .attr("class", "mutation")
                                .attr("cx", 0.0)
                                .attr("cy", function(sample, index) {
                                    return index * that.config.mutation_shape_width;
                                });



                        d3.select(this).selectAll(".mutation").on("mouseover", function(d) {
                            sampleHoverCardHandler.call(this, type_data);
                        });
                    };

                    var renderBars = function(d) {
                        d3.select(this)
                            .selectAll(".mutation-type.mutation")
                                .data(function(d) {
                                    return d.processed_samples.color_by.color_by.bar_data;
                            })
                                .enter()
                            .append("svg:rect")
                                .attr("class", "mutation")
                                .attr("x", -(that.config.mutation_shape_width / 2.0))
                                .attr("y", function(d) {
                                    return d.y;
                                })
                                .attr("width", that.config.mutation_shape_width)
                                .attr("height", function(d) {
                                    return d.height;
                                })
                                .style("fill", function(d) {
                                    return d.color;
                                });

                        d3.select(this).on("mouseover", function(d) {
                            location_hovercard.call(this, d);
                        });
                    };

                    var applyMutationTypeGroups = function(data) {
                        var group = location_to_node_map[data.location];

                        var mutation_type_g = d3
                            .select(this)
                            .selectAll("g.mutation-type")
                                .data(function() {
                                    return data.mutations;
                                }, mutationIdFn);

                        var mutation_type_enter = mutation_type_g.enter(),
                            mutation_type_exit = mutation_type_g.exit();

                        mutation_type_enter
                            .append("svg:g")
                                .attr("class", "mutation-type")
                                .attr("transform", function(d) {
                                    var x = group.scale(mutationIdFn(d)) + that.config.mutation_shape_width / 2.0;
                                    var y = that.config.mutation_groups.stems.height * (layout.mutation_stems.enabled === true ? 1 : 0);
                                    return "translate(" + x + "," + y + ")";
                                })
                                .style("fill", function(d) {
                                    var colors = that.config.mutation_colors,
                                        field = that.config.mutation_color_field;

                                    if (_.has(colors, d[field])) {
                                        return colors[d[field]];
                                    }
                                    else {
                                        return 'lightgray';
                                    }
                                })
                                .style("opacity", 1e-6);

                        if (that.config.enable_transitions) {
                            mutation_type_g = mutation_type_g
                                .transition()
                                .duration(500);

                            mutation_type_exit = mutation_type_exit
                                .transition()
                                .duration(500)
                                .style("opacity", 1e-6);
                        }

                        // Update
                        mutation_type_g
                            .attr("transform", function(d) {
                                var x = group.scale(mutationIdFn(d)) + that.config.mutation_shape_width / 2.0;
                                var y = that.config.mutation_groups.stems.height * (layout.mutation_stems.enabled === true ? 1 : 0);
                                return "translate(" + x + "," + y + ")";
                            })
                            .style("opacity", 1.0);

                        mutation_type_exit
                            .remove();
                    };

                    var mutation_group_g = d3.select(this)
                        .selectAll(".mutation.group")
                            .data(_.map(mutation_data.mutations_by_loc, function(mutations, location) {
                                    return {
                                        location: location,
                                        mutations: mutations
                                    };
                            }, function(d) {
                                return d.location;
                            }));

                    mutation_group_g
                            .enter()
                        .append("svg:g")
                            .attr("class", "mutation group")
                            .attr("transform", function(d) {
                                var node = location_to_node_map[d.location];
                                return "translate(" + node.start_loc + ",0)";
                            });

                    // Update
                    mutation_group_g
                        .each(applyMutationTypeGroups);

                    if (_.has(mutation_data, 'color_by')) {
                        mutation_group_g
                            .selectAll(".mutation-type")
                            .each(renderBars);
                    }
                    else {
                        mutation_group_g
                            .selectAll(".mutation-type")
                            .each(renderCircles);
                    }

                    mutation_group_g
                        .transition()
                        .duration(500)
                        .attr("transform", function(d) {
                            var node = location_to_node_map[d.location];
                            return "translate(" + node.start_loc + ",0)";
                        });

                    mutation_group_g
                        .exit()
                        .remove();
            });
        },

        applyProteinDomains: function() {
            var that = this;

            var tracks = this.vis.root
                .selectAll(".data-area")
                .selectAll("g.seqpeek-track");

            tracks
                .selectAll(".protein")
                .selectAll(".domains")
                .each(function() {
                    var domains_g =  d3.select(this)
                        .selectAll("g.match")
                            .data(function(d) {
                                return d;
                            })
                        .enter()
                        .append("g")
                            .attr("class", function(d) {
                                return "match " + d.dbname;
                            })
                            .attr("transform", function(d) {
                                var category = d[that.config.protein_domains.key];
                                return "translate(0," + that.vis.domain_scale(category) + ")";
                            });

                    domains_g
                        .selectAll("rect.domain-location")
                            .data(function(d) {
                                var fields = ['dbname', 'evd', 'id', 'name', 'status'];
                                var loc_data = [];
                                _.each(d.locations, function(loc) {
                                    var obj = _.pick(d, fields);
                                    obj.location = loc;
                                    loc_data.push(obj);
                                });

                                return loc_data;
                            }, function(d) {
                                return d.id + "+" + d.location.start + "+" + d.location.end;
                            })
                        .enter()
                        .append("rect")
                            .attr("class", "domain-location")
                            .attr("x", function(d) {
                                return d.location.start;
                            })
                            .attr("width", function(d) {
                                var aa_length = d.location.end - d.location.start;
                                return aa_length;
                            })
                            .attr("height", that.config.signature_height)
                            .style("vector-effect", "non-scaling-stroke");

                    domains_g
                        .selectAll("rect.domain-location")
                        .each(function() {
                            d3.select(this).on("mouseover", function(d) {
                                that.tooltips.interpro.call(this, d);
                            });
                        });

                    domains_g
                        .selectAll("rect.domain-location")
                            .attr("x", function(d) {
                                return d.location.start;
                            })
                            .attr("width", function(d) {
                                return aa_length = d.location.end - d.location.start;
                            });
            });
        },

        updateProteinDomains: function() {
            var that = this;

            this.vis.root
                .selectAll(".data-area")
                .selectAll("g.seqpeek-track")
                .each(function(track_data) {
                    d3.select(this)
                        .selectAll("g.domains")
                        .attr("transform", function() {
                            // Transform:
                            //
                            // 1. translate (<viewport x>, <domain placement y>)
                            // 2. scale (<domain rectangle to 100% viewport>, 0)
                            // 3. scale (<viewport x scale>, -1)
                            var trs =
                                "translate(" + (that.vis.viewport_pos[0]) + "," + (track_data.layout.protein_domains.y) + ")" +
                                "scale(" + that.vis.viewport_scale[0] * that.vis.domain_rect_scale_factor + ", -1)";

                            return trs;
                        });
                });
        },

        applyStems: function() {
            var that = this;
            var mutationIdFn = this.mutationIdFn;

            this.vis.refs.symbols.protein.selectAll(".mutations")
                .each(function(track_data) {
                    var diagonal = d3.svg.diagonal()
                        .projection(function(d) {
                            return [d.x, d.y];
                        })
                        .source(function(d) {
                            return {
                                x: that.vis.ref_scale(d.location),
                                y: 0
                            };
                        })
                        .target(function(d) {
                            var node = track_data.mutation_layout.location_to_node_map[d.location];
                            return {
                                x: node.start_loc + that.config.mutation_shape_width / 2.0 + node.scale(mutationIdFn(d)),
                                y: that.config.mutation_groups.stems.height - that.config.mutation_shape_width + 1
                            };
                        });

                    var stem = d3
                        .select(this)
                        .selectAll("path.stem")
                            .data(function(d) {
                                return track_data.layout.mutation_stems.enabled ? d.mutations_processed : [];
                            }, mutationIdFn);

                    var stem_exit = stem.exit();

                    stem
                        .enter()
                        .append("svg:path")
                            .attr("class", "stem")
                            .style("fill", "none")
                            .style("stroke", "gray")
                            .style("stroke-width", that.config.mutation_groups.stems.stroke_width)
                            .style("vector-effect", "non-scaling-stroke")
                        .append("svg:title")
                            .text(function(d) {
                                return that.getMutationLabelRows(d).join("\n");
                            });

                    if (that.config.enable_transitions) {
                        stem = stem
                            .transition()
                            .duration(500);
                    }

                    stem
                        .attr("d", diagonal);

                    stem_exit
                        .remove();
            });
        }
    };

    var SeqPeekFactory = {
        create: function(target_el) {
            var obj = Object.create(SeqPeekPrototype, {}),
                guid = 'C' + vq.utils.VisUtils.guid(); // div id must start with letter

            obj.config = {
                target_el: target_el,
                guid: guid
            };

            return obj;
        }
    };

    // jQuery Plugin
    var methods = {
        init : function(data, options) {
            return this.each(function() {
                var $this = $(this);
                var vis;
                $this.data("SeqPeek", (vis = SeqPeekFactory.create($this.get(0))));
                vis.draw(data, options);
            });
        },
        change_subtypes : function(new_tracks, order) {
            return this.each(function() {
                var vis = $(this).data("SeqPeek");
                if (vis) {
                    vis.changeTracks(new_tracks, order);
                }
            });
        },
        get_size: function() {
            var vis = $(this).data("SeqPeek");
            if (vis) {
                return vis.getSize();
            }

            return null;
        },
        set_subtype_order: function() {
            return this;
        },
        set_stems : function(stems_enabled) {
            return this.each(function() {
                var vis = $(this).data("SeqPeek");
                if (vis) {
                    vis.setStems(stems_enabled);
                }
            });
        }
    };

    $.fn.seqpeek = function( method ) {
        if ( methods[method] ){
            return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
        }
        else if ( typeof method === 'object' || ! method ) {
            return methods.init.apply( this, arguments );
        }
        else {
            $.error( 'Method ' +  method + ' does not exist on jQuery.seqpeek' );
        }
    };
}(window.jQuery);