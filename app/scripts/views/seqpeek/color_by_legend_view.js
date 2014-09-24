define([
    "jquery",
    "underscore",
    "backbone",
    "hbs!templates/seqpeek/color_by_legend"
],
function ($, _, Backbone,
          Tpl
) {
    return Backbone.View.extend({
        setData: function(color_by_type, color_map, data_array) {
            var keyed_rows = _.chain(data_array)
                .map(function(data_point) {
                    return {
                        data_point: data_point,
                        color_fn_key: color_map.getKey(data_point)
                    };
                })
                .value();

            var color_by_items = _.chain(keyed_rows)
                .map(function(row) {
                    return {
                        label: color_map.getGroupLabel(row.data_point),
                        color: color_map.getColor(row.data_point).color
                    }
                })
                .unique(function(d) {
                    return d.label;
                })
                .value();

            this.render(color_by_type, color_by_items);
        },

        render: function (color_by_type, color_by_items) {
            var template_data = {
                color_by_type: color_by_type,
                items: color_by_items
            };

            this.$el.html(Tpl(template_data));

            return this;
        }
    });
});
