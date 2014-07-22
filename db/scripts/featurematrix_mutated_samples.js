/*
- Reads from "feature_matrix" collection
- Query, Filter Mutated ("1"), Group By Gene
- Writes to map reduce output to "mutated_samples_mrtemp" collection
- Drops and writes transformed output to "mutated_samples" collection

Usage:

    mongo --host=$HOST $DB_NAME mapreduce_mutated_samples.js

Example of the type of features targeted for aggregation by this script. Must be run on each tumor_type feature matrix independently.
{
    "_id" : ObjectId("52d484d43d8a1d038104f407"),
    "id" : "B:GNAB:A1BG:chr19:58858172:58874214:-:y_n_somatic",
    "strand" : "-",
    "gene" : "A1BG",
    "end" : 58874214,
    "start" : 58858172,
    "source" : "GNAB",
    "chr" : "19",
    "code" : "y_n_somatic",
    "type" : "B"
}
 */

var map = function () {
    if (this.gene === undefined) return;
    if (this.values === undefined) return;

    for(var sample_id in this.values) {
        var is_mutated = parseInt(this.values[sample_id]);
        if (!isNaN(is_mutated) && is_mutated === 1) {
            emit(this.gene, sample_id);
        }
    }
};

var reduce = function(gene, sample_ids) {
    return {
        "gene": gene,
        "sample_ids": sample_ids,
        "numberOf": sample_ids.length
    };
};

var finalize = function(key, reducedValue) {
    if (reducedValue["sample_ids"] === undefined) {
        return {
            "gene": key,
            "sample_ids": [reducedValue],
            "numberOf": 1
        }
    }
    return reducedValue;
};

var query = {
    "source":"GNAB",
    "code":"code_potential_somatic",
    "type": "B",
    "gene": { "$exists": true }
};

var db_name = db["_name"];
var pretty_print = function(msg) {
    var dtFmt = (new Date()).toString();
    print("[INFO] " + dtFmt  + " - featurematrix_mutated_samples(" + db_name + ") - " + msg);
};

pretty_print("matching features from feature_matrix:" + db["feature_matrix"].find(query).count());
db["feature_matrix"].mapReduce(map, reduce, { "query": query, "out": "mutated_samples_mrtemp", "finalize": finalize });

db["mutated_samples"].drop();
db["mutated_samples_mrtemp"].find().forEach(function(d) {
    db["mutated_samples"].insert(d.value);
});
db["mutated_samples_mrtemp"].drop();

pretty_print("final result in mutated_samples:" + db["mutated_samples"].find().count());
