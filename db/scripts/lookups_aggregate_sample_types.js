/*
- Extracts clinical variables from "feature_matrix" collection into GLOBAL lookup collection

Usage:

    mongo --host=$HOST $DB_NAME lookups_aggregate_sample_types.js --eval="var lookups_db_uri='hostname:port/LOOKUPS';"
 */

var lookups_db = connect(lookups_db_uri);
var db_name = db["_name"];
var query = { "id": "C:SAMP:TNtype:::::" };

var pretty_print = function(msg) {
    var dtFmt = (new Date()).toString();
    print("[INFO] " + dtFmt  + " - lookups_aggregate_sample_types(" + db_name + ") - " + msg);
};

pretty_print("lookups_db=" + lookups_db_uri + ":" + lookups_db);
pretty_print("initial check=" + db["feature_matrix"].find(query).count());
pretty_print("initial check=LOOKUPS:" + lookups_db["sample_types"].count());

db["feature_matrix"].find(query).forEach(function(doc) {
    lookups_db["sample_types"].insert({
        "id": doc["id"],
        "label": doc["label"],
        "source": doc["source"],
        "values": doc["values"],
        "tumor_type": db_name
    });
});

pretty_print("final check=LOOKUPS:" + lookups_db["sample_types"].count());
pretty_print("COMPLETED");
