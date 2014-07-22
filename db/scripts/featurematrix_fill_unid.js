/*
- Reads from "feature_matrix" collection
- Updates each feature with a "unid" that more coarsely defines uniqueness

Usage:

    mongo --host=$HOST $DB_NAME featurematrix_fill_unid.js

Example of the type of features targeted for aggregation by this script. Must be run on each tumor_type feature matrix independently.
{
      "_id": "537bde73ab47b3606a2b2f5f",
      "end": 7590856,
      "chromosome": "chr17",
      "start": 7565097,
      "tags": [
        "TP53"
      ],
      "label": "TP53 (7157)",
      "source": "GEXP",
      "platform": "mRNAseq",
      "gene": "TP53",
      "type": "N",
      "id": "N:GEXP:TP53:chr17:7565097:7590856:-:7157",
      "strand": "-"
}

Uniqueness_id ->       "unid": "N:GEXP:TP53:7157"
*/

var db_name = db["_name"];

var UNID_builder = function(doc, key_ids) {
    var keys = [];
    key_ids.forEach(function(key_id) {
        if (doc[key_id]) keys.push(doc[key_id]);
    });
    return keys.join(":");
};

var UNID_generators = {
    "GEXP": function(doc) {
        return UNID_builder(doc, ["type", "source", "gene", "code"]);
    },
    "GNAB": function(doc) {
        return UNID_builder(doc, ["type", "source", "gene", "code"]);
    },
    "MIRN": function(doc) {
        return UNID_builder(doc, ["type", "source", "accession_number", "code"]);
    },
    "CNVR": function(doc) {
        return UNID_builder(doc, ["type", "source", "chromosome", "start", "end", "code"]);
    },
    "METH": function(doc) {
        return UNID_builder(doc, ["type", "source", "probe"]);
    },
    "RPPA": function(doc) {
        return UNID_builder(doc, ["type", "source", "antibody"]);
    },
    "CLIN": function(doc) {
        return UNID_builder(doc, ["type", "source", "code"]);
    },
    "SAMP": function(doc) {
        return UNID_builder(doc, ["type", "source", "code"]);
    }
};

for (var src in UNID_generators) {
    var dtFmt = (new Date()).toString();
    print("[INFO] " + dtFmt  + " - featurematrix_fill_unid(" + db_name + "):" + src + ":" + db["feature_matrix"].find({ "source": src }).count());

    var unid_generator = UNID_generators[src];
    db["feature_matrix"].find({ "source": src }).forEach(function(doc) {
        db["feature_matrix"].update({
            "_id": doc["_id"]
        }, {
            "$set": { "unid": unid_generator(doc) }
        });
    });
}