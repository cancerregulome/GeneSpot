var View = require('./view');
var template = require('./templates/oncovis');
var FeatureMatrix = require('../models/featureMatrix');

module.exports = View.extend({
    model:FeatureMatrix,
    template:template,
    label:"Oncovis",

    events:{
        "click .reset-sliders":"resetSliders"
    },

    initialize:function () {
        _.bindAll(this, 'renderGraph', 'initControls', 'autocomplete', 'render', 'resetSliders');
    },

    afterRender:function () {
        var _this = this;
        this.$el.addClass('row');
        this.initControls();
        this.model.on('load', _this.renderGraph);
    },

    renderGraph:function () {
        this.initControls();

        console.log("renderGraph:start");

        var loaded_data = this.model.toJSON();

        var cluster_property = "C:CLIN:Assisted_Pregnancy:M::::";
        var rowLabels = [
            "C:SURV:Alcohol_Consumption:F::::",
            "C:SURV:Alcohol_Consumption:M::::",
            "C:SURV:Family_History_of_PTB:F::::",
            "C:SURV:Family_History_of_PTB:M::::",
            "C:SURV:Mothers_Country_of_Birth:F::::"
        ];

        var data = {};
        var clusterGroups = {};
        var clusterLabels = {};
        var categories_by_rowlabel = {};

        _.each(loaded_data, function (item) {
            var feature_id = item["feature_id"];

            var isRowLabel = (rowLabels.indexOf(feature_id) >= 0);

            var isClusterLabel = (cluster_property == feature_id);
            var sample_ids = _.without(_.without(_.keys(item), "label"), "feature_id");

            _.each(sample_ids, function (sampleId) {
                var value = item[sampleId];
                if (!data[sampleId]) data[sampleId] = {};

                if (isRowLabel) {
                    data[sampleId][feature_id] = { "value":value, "row": feature_id, "label":sampleId + "\n" + item.label + "\n" + value };

                    if (!categories_by_rowlabel[feature_id]) categories_by_rowlabel[feature_id] = {};
                    categories_by_rowlabel[feature_id][value] = true;
                }

                if (isClusterLabel) {
                    if (!clusterGroups[value]) clusterGroups[value] = [];
                    clusterGroups[value].push(sampleId);
                    clusterLabels[value] = true;
                }
            });
        });

        var oncovisData = {
            data: data,
            columns_by_cluster: clusterGroups,
            cluster_labels:_.keys(clusterLabels),
            row_labels: rowLabels
        };

        var columns_by_cluster = {};
        _.each(oncovisData.columns_by_cluster, function (columns, cluster) {
            columns_by_cluster[cluster] = _.sortBy(columns, function (sample) {
                return _.map(rowLabels, function (row_label) { return data[sample][row_label]["value"].toLowerCase(); });
            });
        });

        var colorscales_by_rowlabel = { overrides: {} };
        _.each(categories_by_rowlabel, function(obj, rowLabel) {
            var categories = _.keys(obj);
            colorscales_by_rowlabel[rowLabel] = d3.scale.ordinal()
                                                          .domain(categories)
                                                          .range(d3.range(categories.length)
                                                          .map(d3.scale.linear().domain([0, categories.length - 1])
                                                          .range(["yellow", "blue"])
                                                          .interpolate(d3.interpolateLab)));
        });

        var optns = {
            bar_width:4,
            column_spacing:1,
            plot_width:3000,
            label_width:70,
            highlight_fill:colorbrewer.RdYlGn[3][2],
            color_fn:function (d) {
                return colorscales_by_rowlabel[d.row](d.value);
            },
            columns_by_cluster:columns_by_cluster,
            cluster_labels:oncovisData.cluster_labels,
            row_labels:oncovisData.row_labels
        };

        _.extend(optns, { "bar_height":this.$el.find(".slider_barheight").oncovis_range_value() });
        _.extend(optns, { "row_spacing":this.$el.find(".slider_rowspacing").oncovis_range_value() });
        _.extend(optns, { "bar_width":this.$el.find(".slider_barwidth").oncovis_range_value() });
        _.extend(optns, { "column_spacing":this.$el.find(".slider_barspacing").oncovis_range_value() });
        _.extend(optns, { "cluster_spacing":this.$el.find(".slider_clusterspacing").oncovis_range_value() });
        _.extend(optns, { "label_fontsize":this.$el.find(".slider_fontsize").oncovis_range_value() });

        this.$el.find(".oncovis-container").oncovis(oncovisData.data, optns);

        this.renderLegend(categories_by_rowlabel, colorscales_by_rowlabel);

        console.log("renderGraph:end");
    },

    renderLegend: function(categories_by_rowlabel, colorscales_by_rowlabel) {
        console.log("renderLegend:start");

        var accordionEl = this.$el.find(".oncovis-legend");
        _.each(categories_by_rowlabel, function(obj, rowLabel) {
            var categories = _.keys(obj);
            accordionEl.append("<h5><a href='#'>" + rowLabel + "</a></h5>");
            var lis = [];
            _.each(categories, function(category) {
                var color = colorscales_by_rowlabel[rowLabel](category);
                lis.push("<li><span data-row='" + rowLabel + "' data-ref='" + category + "' class='color-category' style='background-color:" + color + "'>&nbsp;&nbsp;&nbsp;</span>" + category + "</li>");
            });
            accordionEl.append("<ul>" + lis.join("") + "</ul>");
        });

        accordionEl.accordion({ "collapsible": true, "autoHeight": false });

        var oncovis_container = this.$el.find(".oncovis-container");

        $(".color-selection").live("click", function(e) {
            var data = $(e.target).data();
            var row = data["row"];
            var ref = data["ref"];
            var color = data["color"];

            if (!colorscales_by_rowlabel.overrides[row]) colorscales_by_rowlabel.overrides[row] = {};
            colorscales_by_rowlabel.overrides[row][ref] = color;

            oncovis_container.update({
                color_fn: function(d) {
                    if (colorscales_by_rowlabel.overrides[d.row] && colorscales_by_rowlabel.overrides[d.row][d.value]) {
                        return colorscales_by_rowlabel.overrides[d.row][d.value];
                    }
                    return colorscales_by_rowlabel[d.row](d.value);
                }
            });

            _.each($(".color-category"), function(cc) {
                var el = $(cc);
                if (el.data()["row"] == row && el.data()["ref"] == ref) cc.style["background-color"] = color;
            });

            $(".color-category").popover("hide");
        });

        $(".color-category").popover({
            placement: "left",
            title: function() {
                return "Color Selection (" + $(this).data()["ref"] + ")";
            },
            content: function() {
                var row = $(this).data()["row"];
                var ref = $(this).data()["ref"];


                var addColorSpan = function(color) {
                    return "<span class='color-selection' style='background-color:" + color + "' data-row='" + row + "' data-color='" + color + "' data-ref='" + ref + "'>&nbsp;&nbsp;&nbsp;</span>";
                };
                var html = "";
                html += "<ul>";
                html += addColorSpan("red");
                html += addColorSpan("blue");
                html += addColorSpan("green");
                html += addColorSpan("yellow");
                html += addColorSpan("lightgray");
                html += addColorSpan("lightgreen");
                html += addColorSpan("lightblue");
                html += "</ul>";
                return html;
            }
        });

        console.log("renderLegend:end");
    },

    initControls:function () {
        console.log("initControls:start");
        var me = this;
        var visrangeFn = function (property) {
            return function (value) {
                var dim = {};
                dim[property] = value;
                me.$el.find(".oncovis-container").update(dim);
            }
        };

        this.$el.find(".slider_barheight").oncovis_range({ storageId:"slider_barheight", min:10, max:50, initialStep:20, slide:visrangeFn("bar_height") });
        this.$el.find(".slider_rowspacing").oncovis_range({ storageId:"slider_rowspacing", min:0, max:50, initialStep:10, slide:visrangeFn("row_spacing") });
        this.$el.find(".slider_barwidth").oncovis_range({ storageId:"slider_barwidth", min:1, max:10, initialStep:5, slide:visrangeFn("bar_width") });
        this.$el.find(".slider_barspacing").oncovis_range({ storageId:"slider_barspacing", min:0, max:10, initialStep:2, slide:visrangeFn("column_spacing") });
        this.$el.find(".slider_clusterspacing").oncovis_range({ storageId:"slider_clusterspacing", min:0, max:50, initialStep:10, slide:visrangeFn("cluster_spacing") });
        this.$el.find(".slider_fontsize").oncovis_range({ storageId:"slider_fontsize", min:5, max:21, initialStep:14, slide:visrangeFn("label_fontsize") });

        console.log("initControls:end");
    },

    autocomplete:function (query, resultBin) {
        var found = [];

        var queryterms = query.toLowerCase().split(" ");
        _.each(queryterms, function (queryterm) {
            _.each(oncovisData.data, function (val, key) {
                if (key.toLowerCase().indexOf(queryterm) >= 0) {
                    found.push("<a href='#oncovis/p:" + key + "'>Patient ID " + key + "</a>");
                }
            });
        });
        resultBin(found);
    },

    resetSliders:function () {
        this.$el.find(".slider_barheight").oncovis_range_reset();
        this.$el.find(".slider_rowspacing").oncovis_range_reset();
        this.$el.find(".slider_barwidth").oncovis_range_reset();
        this.$el.find(".slider_barspacing").oncovis_range_reset();
        this.$el.find(".slider_clusterspacing").oncovis_range_reset();
        this.$el.find(".slider_fontsize").oncovis_range_reset();
    }
});
