/*
- Extracts top20 ranked genes from "mutsig_rankings" collection into GLOBAL lookup collection

Usage:

    mongo --host=$HOST $DB_NAME mutsigrankings_top20.js
 */

var db_name = db["_name"];
var pretty_print = function(msg) {
    var dtFmt = (new Date()).toString();
    print("[INFO] " + dtFmt  + " - mutsigrankings_top20(" + db_name + ") - " + msg);
};

pretty_print("START");

db["mutsig_rankings_top20"].drop();
db["mutsig_rankings"].find({ "rank": { "$lte": 20 } }).forEach(function(doc) {
    db["mutsig_rankings_top20"].insert(doc);
});

pretty_print("COMPLETED");
