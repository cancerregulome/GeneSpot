define([
    "jquery",
    "underscore",
    "backbone",
    "hbs!templates/seqpeek/sample_list_operations"
],
function ($, _, Backbone,
          Tpl
    ) {

    return Backbone.View.extend({
        events: {
            "click .list-union-op": function(e) {
                var listid = $(e.target).data("id");
                this.trigger("list:union", this.collection.get(listid));
            }
        },

        initialize: function() {
            _.bindAll(this, "__refresh");

            this.collection.on("add remove change", this.__refresh, this);
        },

        render: function() {
            this.__refresh();

            return this;
        },

        getCurrentListAsMap: function() {
            console.log("test");
            var listid = this.$("li.active").text();

            var found = this.collection.find(function(item) {
                return item.get("label") == listid;
            });

            var samples = found.get("samples");

            return _.reduce(samples, function(memo, sample_id) {
                memo[sample_id] = true;
                return memo;
            }, {});
        },

        __refresh: function() {
            var template_data = this.collection.map(function(model) {
                var samples = model.get("samples");
                var text_content = samples.join("\n");

                return {
                    "id": model["id"],
                    "label": model.get("label"),
                    "samples": samples,
                    "text": text_content,
                    "number_samples": samples.length
                };
            });

            this.$el.html(Tpl({ "samplelists": _.sortBy(template_data, "sort") }));
        }
    });
});
