/*
 - Reads all collections in the database, and extract all fields, preparing a lookup collection
 - Writes to "collection_fields" collection

 - Documents in collection will look like this:
    { "_id" : <field_A>, "value" : <collection_name> }

 Usage:

 mongo --host=$HOST $DB_NAME mapreduce_collection_fields.js

 // TODO : Organize output better
 */

var mapFn = function () {
    for (var field in this) {
        if (field === "_id") continue;
        emit(field, null);
    }
};

var reduceFn = function (field) {
    return field;
};

var finalizeFn = function() {
    return target_collection;
};

var db_name = db["_name"];
var pretty_print = function(msg) {
    var dtFmt = (new Date()).toString();
    print("[INFO] " + dtFmt  + " - misc_aggregate_collection_fields(" + db_name + ") - " + msg);
};

db["collection_fields"].drop();

db.getCollectionNames().forEach(function (collection_name) {
    if (collection_name === "system.indexes") return;
    if (collection_name === "collection_fields") return;

    pretty_print(collection_name);
    db[collection_name].mapReduce(mapFn, reduceFn, {
        "out": {
            "merge": "collection_fields"
        },
        "scope": {
            "target_collection": collection_name
        },
        "finalize": finalizeFn
    });
});

pretty_print("unique fields captured:" + db["collection_fields"].count());
