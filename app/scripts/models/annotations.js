define(["jquery", "underscore", "backbone", "d3"],
    function ($, _, Backbone, d3) {

        return Backbone.Model.extend({

            parse: function (data) {
                var itemsById = {};

                if (this.get("dataType") == "json") {
                    if (data && data.items) {
                        _.each(data.items, function (item) {
                            itemsById[item.id || item.feature_id] = item;
                        });
                    }
                } else {
                    _.each(d3.tsv.parse(data), function (row) {
                        if (row["ID"]) {
                            var item = {};
                            _.each(_.keys(row), function (k) {
                                item[k.toLowerCase()] = row[k];
                            });
                            itemsById[item.id] = item;
                        }
                    });
                }
                return { "itemsById": itemsById, "keys": _.keys(itemsById) };
            },

            fetch:function (options) {
                return Backbone.Model.prototype.fetch.call(this, _.extend({}, options, {dataType:"text"}));
            }
        });

    });