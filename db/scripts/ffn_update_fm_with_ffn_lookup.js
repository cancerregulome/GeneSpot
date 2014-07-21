/*
  usage: mongo <host>:<port>/<db> update_fm_with_label_lookup.js --eval "var ftypes = ['RPPA', 'METH']"
  if eval clause not included, will run against all feature types
*/
function replaceUnderscore(str) {
  return str.replace(/_/g, ' ');
}

var debugCLINCounts = [0, 0, 0, 0, 0, 0];
var twoReplace = "$3: $1 vs $2";
var oneReplace = "$2: $1";
//	In some cases, the string(s) in front of the '|' are not unique/specific enough and we will need to include the feature name after the '|' as follows
//	C:SAMP:I(A|X) ==> f(X) A
//	C:SAMP:I(A,B|X) ==> f(X) A vs B
var checks = [
//	cases where we have G1,G2,.. drop the 'G' (redundant with the word grade)
//	B:CLIN:I(G1|neoplasm_histologic_grade)::::: => neoplasm histologic grade 1 
  [/I\(G([0-9]+),G([0-9]+)\|(.+)\)/m, twoReplace], 
//	B:CLIN:I(G1,G2|neoplasm_histologic_grade)::::: => neoplasm histologic grade 1 vs 2
  [/I\(G([0-9]+)\|(.+)\)/m, oneReplace], 
//	cases where we have C1,C2,... (these are cluster #s) -- drop the 'C'
//	C:SAMP:I(C1,C2|X) ==> f(X) 1 vs 2
  [/I\(C([0-9]+),C([0-9]+)\|(.+)\)/m, twoReplace], 
//	C:SAMP:I(C1|X) ==> f(X) 1
  [/I\(C([0-9]+)\|(.+)\)/m, oneReplace], 
//	pathologic_T, pathologic_N, pathologic_M, WHO_class
  [/I\((.+),(.+)\|(.+)\)/m, twoReplace], 
  [/I\((.+)\|(.+)\)/m, oneReplace]
];
// I(All_Mets.v3)
var nobar = /I\(([^|]+)\)/
function getCLINorSAMPLabel(code) {
  for (var i = 0; i < checks.length; i++) {
    if (checks[i][0].test(code)) {
      debugCLINCounts[i]++;
      var retVal = code.replace(checks[i][0], checks[i][1]);
      return replaceUnderscore(retVal.substring(0, 1).toUpperCase() + retVal.substring(1));
    }
  }
  if (nobar.exec(code)) {
    code = code.replace(nobar, "In $1");
  }
  
  return replaceUnderscore(code.substring(0, 1).toUpperCase() + code.substring(1));
}

var getCLINLabel = function(doc) {
  return retVal = getCLINorSAMPLabel(doc["code"]);
}

var getSAMPLabel = function(doc) {
  return getCLINorSAMPLabel(doc["code"]);
}

/*
  from stackoverflow: http://stackoverflow.com/questions/1068284/format-numbers-in-javascript
*/
function addCommas(num) {
  var parts = (num + "").split("."),
    main = parts[0],
    len = main.length,
    output = "",
    i = len - 1;

  while(i >= 0) {
    output = main.charAt(i) + output;
    if ((len - i) % 3 === 0 && i > 0) {
      output = "," + output;
    }
    --i;
  }
  // put decimal part back
  if (parts.length > 1) {
    output += "." + parts[1];
  }
  return output;
}

function getLocation(doc) {
  return doc["chromosome"] + ':' + addCommas(doc["start"]) + '-' + addCommas(doc["end"])
}

var units = ['bp', 'kb', 'Mb', 'Gb']
function getLength(start, end) {
  var length = parseInt(end) - parseInt(start);
  for (i = 0; i < units.length - 1; i++) {
    if (1 > (parseFloat(length) / 1000)) {
      return Math.round(length) + units[i];
    }
    length /= 1000;
  }
  return Math.round(length) + units[units.length - 1];
}

var debugCNVRCounts = [0, 0, 0, 0, 0, 0];
// Gistic and GisticArm features
// N:CNVR:Xq:chrX:60600000:155270560::SKCM-All_Lymph_Node_GisticArm_d
//    ==> Xq  (Gistic Arm)
// N:CNVR:Xq28:chrX:150021680:150280252::SKCM-All_Regional_Metastases_Gistic_ROI_r_amp
//    ==> Xq28 Amplification (Gistic, continuous)
// N:CNVR:Xq28:chrX:150021680:150280252::SKCM-All_Regional_Metastases_Gistic_ROI_d_del
//    ==> Xq28 Deletion (Gistic, discrete)

// Resegmented features
// N:CNVR:Xq22.2:chrX:60600000:155270560
//    ==> chrX:60,600,000-155,270,560 (95MB, Xq22.2)
// N:CNVR:8q24:chr8:138862000:140900999::
//    ==> chr8:138,862,000-140,900,999 (2MB, 8q24)
// N:CNVR:SRGAP2:chr1:158887000:158888999::
//    ==> chr1:158,887,000-158,888,999 (2kb, SRGAP2)
var getCNVRLabel = function(doc) {
  if (doc["code"]) {
    if (-1 < doc["code"].indexOf('GisticArm')) {
      debugCNVRCounts[0]++;
      return replaceUnderscore(doc["locus"] + ' (Gistic Arm)');
    } else if (-1 < doc["code"].indexOf('Gistic')) {
      var fields = doc["code"].split('_');
      var gType = fields[fields.length - 1] == 'del'? 'Deletion' : 'Amplification';
      var index = fields[fields.length - 1] == 'del'? 0 : 1;
      var dType = fields[fields.length - 2] == 'd'? 'discrete' : 'continuous';
      index += fields[fields.length - 2] == 'd'? 3 : 5;
      debugCNVRCounts[index - 2]++;
      return replaceUnderscore(doc["locus"] + ' ' + gType + ' (Gistic, ' + dType + ')');
    } else if (-1 < doc["code"].indexOf('LOH')) {
      return replaceUnderscore(doc["locus"] + ' (LOH)');
    } else {
      return replaceUnderscore(doc["locus"] + ' (' + doc["code"] + ')');
    }
  } else {
    debugCNVRCounts[5]++;
    var loc = getLocation(doc)
    length = getLength(doc["start"], doc["end"]);
    return replaceUnderscore(loc + ' (' + length + ', ' + doc["locus"] + ')');
  }
}

var of = /([0-9]+)of([0-9]+)/;
var getGEXPLabel = function(doc) {
  var retVal = doc["gene"];
  var code = doc["id"].split(':')[7]
  if (doc["platform"] == "mRNAseq" && of.test(code)) {
    retVal += ' (' + code.replace(of, "$1 of $2") + ')';
  }
  return replaceUnderscore(retVal);
}

var getMIRNLabel = function(doc) {
  return replaceUnderscore(doc["microRNA"]);
}

var mappings = new Object();
mappings['nonsilent_somatic'] = "Excluding Silent Mutations";
mappings['code_potential_somatic'] = "Protein Coding";
mappings['missense_somatic'] = "Missense";
mappings['mnf_somatic'] = "Missense-Nonsense-Frameshift";
mappings['mni_somatic'] = "Missense-Nonsense-Inframe-Frameshift";
mappings['y_n_somatic'] = "All Mutations";
var getGNABLabel = function(doc) {
  var name = doc["gene"];
  var code = mappings[doc["code"]];
  if (!code) {
    code = doc["code"];
  }
  return replaceUnderscore(name + ' - ' + code);
}

var getMETHLabel = function(doc) {
  var gene = doc["id"].split(':')[2]
  var fields = doc["code"].split('_');
  var probe = fields[0];
  var tf_loc = '';
  if (1 < fields.length) {
    tf_loc += fields[1];
    for (var i = 2; i < fields.length; i++) {
      tf_loc += ', ';
      tf_loc += fields[i];
    }
  }
  
  if (tf_loc) {
    return replaceUnderscore(gene + ' (' + tf_loc + ') ' + probe);
  }
  else {
    return replaceUnderscore(gene + ' ' + probe);
  }
}

var endInfo = /^(.+)-[RMVCEG]-[A-Z]$/
var endInfo1 = /^(.+)-[RMVCEG]-NA$/
var endInfo2 = /^(.+)-[RMVCEG]$/
var noInfo = /(.+)\-NA/
var phosphor = /^(.+)[_\-]p([STY][0-9]+.*)$/
var getRPPALabel = function(doc) {
  var antibody =  doc["antibody"];
  var matchEndInfo = endInfo.exec(antibody);
  if (matchEndInfo) {
    antibody = matchEndInfo[1];
  }
  var matchEndInfo = endInfo1.exec(antibody);
  if (matchEndInfo) {
    antibody = matchEndInfo[1];
  }
  var matchEndInfo = endInfo2.exec(antibody);
  if (matchEndInfo) {
    antibody = matchEndInfo[1];
  }
  var matchNoInfo = noInfo.exec(antibody);
  if (matchNoInfo) {
    antibody = matchNoInfo[1];
  }
  
  var matchPhosphor = phosphor.exec(antibody);
  var phos = '';
  if (matchPhosphor) {
    antibody = matchPhosphor[1];
    phos = matchPhosphor[2];
  }
  
  var gene = doc["id"].split(':')[2];
  if (phos) {
    var pfields = phos.split('_');
    phos = 'p' + pfields[0];
    for (var i = 1; i < pfields.length; i++) {
      phos += ', p' + pfields[i];
    }
    return replaceUnderscore(gene + ' (' + phos + ')');
  } else {
    return replaceUnderscore(gene);
  }
}

function processFFNForFType(fType, func) {
  var count = 0;
  db.feature_matrix.find({"source":fType}, {"values": false}).forEach(
    function(doc) {
      if (0 == (count++ % 4096)) {
        print("processing record " + count + " " + new Date());
      }
    
      db.feature_matrix.update({"id":doc["id"]}, {$set: {"label":func(doc)}});
    }
  )
  print("total updates: " + count + " " + new Date())
}

var default_ftypes = ['CLIN', 'SAMP', 'CNVR', 'GEXP', 'MIRN', 'GNAB', 'METH', 'RPPA'];
//var ftypes = ['RPPA'];
var ftype2func = {
    'CLIN': getCLINLabel,
    'SAMP': getSAMPLabel,
    'CNVR': getCNVRLabel,
    'GEXP': getGEXPLabel,
    'MIRN': getMIRNLabel,
    'GNAB': getGNABLabel,
    'METH': getMETHLabel,
    'RPPA': getRPPALabel
  };

if (typeof ftypes == 'undefined') {
  print('using default array of feature types');
  ftypes = default_ftypes;
}
db.feature_matrix.ensureIndex( {"id" : 1}, {unique: true});
for (var ftype in ftypes) {
  print('start ' + ftypes[ftype] + ': ' + new Date());
  processFFNForFType(ftypes[ftype], ftype2func[ftypes[ftype]]);
  print('end ' + ftypes[ftype] + ': ' + new Date() + '\n');
}

print("'|' clinical/sample counts: " + debugCLINCounts.join(' '));
print("copy number counts: " + debugCNVRCounts.join(' '));
