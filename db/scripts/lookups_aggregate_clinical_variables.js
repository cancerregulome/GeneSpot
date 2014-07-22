/*
- Extracts clinical variables from "feature_matrix" collection into GLOBAL lookup collection

Usage:

    mongo --host=$HOST $DB_NAME lookups_aggregate_clinical_variables.js --eval="var lookups_db_uri='hostname:port/LOOKUPS';"
 */

var lookups_db = connect(lookups_db_uri);
var db_name = db["_name"];
var pretty_print = function(msg) {
    var dtFmt = (new Date()).toString();
    print("[INFO] " + dtFmt  + " - lookups_aggregate_clinical_variables(" + db_name + ") - " + msg);
};

pretty_print("START");

var group_variables_fn = function(doc) {
    var details = {
        "id": doc["id"],
        "label": doc["label"],
        "tumor_type": db_name,
        "source": doc["source"]
    };
    lookups_db["all_clinical"].update({
        "id": doc["id"]
    }, {
        "$set": { "label": doc["label"] },
        "$push": { "features": details }
    }, true);
};

pretty_print("initial check=LOOKUPS:" + lookups_db["all_clinical"].count());

pretty_print("update:started:CLIN");
db["feature_matrix"].find({ "source": "CLIN" }).forEach(group_variables_fn);

pretty_print("update:started:SAMP");
db["feature_matrix"].find({ "source": "SAMP" }).forEach(group_variables_fn);

pretty_print("update:completed");

var result = lookups_db["all_clinical"].aggregate([ { "$unwind": "$features" }, { "$group": { "_id": "$features.tumor_type", "cnt": { "$sum": 1 } } } ]);
result["result"].forEach(printjson);
pretty_print("COMPLETED");
