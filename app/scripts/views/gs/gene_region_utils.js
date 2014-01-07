define([
    'underscore'
],
function(
    _
) {
    var build_region_common = function(start, end) {
        var region = {};

        if (start === null) {
            region = _.extend(region, {
                end: end,
                belongs: function(coordinate) {
                    return coordinate <= end;
                },
                data: []
            });
        }
        else if (end === null) {
            region = _.extend(region, {
                start: start,
                belongs: function(coordinate) {
                    return coordinate >= start;
                },
                data: []
            });
        }
        else {
            region = _.extend(region, {
                start: start,
                end: end,
                belongs: function(coordinate) {
                    return start <= coordinate && coordinate <= end;
                },
                data: []
            });
        }

        return region;
    };

    var build_noncoding_region = function(start, end) {
        var region = build_region_common(start, end);

        return _.extend(region, {
            type: 'noncoding'
        });
    };

    var build_exon_region = function(start, end) {
        var region = build_region_common(start, end);

        return _.extend(region, {
            type: 'exon'
        });
    };

    return {
        buildRegionsFromArrayWithNonCoding: function(param_regions) {
            var region_info = _.reduce(param_regions, function(memo, region) {
                if (region.start - memo.last_end > 1) {
                    memo.region_array.push(build_noncoding_region(memo.last_end + 1, region.start - 1));
                }

                memo.region_array.push(build_exon_region(region.start, region.end));

                memo.last_start = region.start;
                memo.last_end = region.end;

                return memo;
            }, {
                region_array: [],
                last_start: null,
                last_end: null
            });

            return region_info.region_array;
        },

        buildRegionsFromArray: function(param_regions) {
            return _.map(param_regions, function(region_info) {
                if (region_info.type == 'noncoding') {
                    return build_noncoding_region(region_info.start, region_info.end);
                }
                else if (region_info.type == 'exon') {
                    return build_exon_region(region_info.start, region_info.end);
                }
            });
        },

        fillDataIntoRegions: function(gene_regions, data_points, param_coordinate_getter) {
            var coordinate_get_fn;
            var discarded = 0;

            if (_.isFunction(param_coordinate_getter)) {
                coordinate_get_fn = param_coordinate_getter
            }
            else if (_.isString(param_coordinate_getter)) {
                coordinate_get_fn = function(d) {
                    return d[param_coordinate_getter];
                }
            }
            else {
                console.error("Coordinate getter is not a function or string");
            }

            _.each(data_points, function(d) {
                var    bin = _.find(gene_regions, function(region) {
                    return region.belongs(coordinate_get_fn(d));
                });

                if (bin === undefined) {
                    discarded = discarded + 1;
                }
                else {
                    bin.data.push(d);
                }
            });

            if (discarded > 0) {
                console.warn(discarded + " data points do not match into any region");
            }
        }
    };

// end define
});
