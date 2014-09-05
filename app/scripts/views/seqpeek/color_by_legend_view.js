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
        setData: function(color_by_type, color_map, data_getter, data_array) {
            var unique_rows = _.chain(data_array)
                .unique(function(data_point) {
                    return data_getter(data_point)
                })
                .map(function(data_point) {
                    return {
                        data_point: data_point,
                        color_fn_key: data_getter(data_point)
                    };
                })
                .value();

            var color_by_items = _.chain(unique_rows)
                .map(function(row) {
                    return {
                        label: row.color_fn_key,
                        color: color_map(row.data_point)
                    };
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
