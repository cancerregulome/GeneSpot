define([

], function(

) {
    ///////////////////////////////////////////////////////////
    //
    // Module for grouping and coloring by amino acid,
    // as defined in Lesk, Introduction to Bioinformatics:
    //
    // http://www.bioinformatics.nl/~berndb/aacolour.html
    //
    //


    var UNKNOWN_TYPE_COLOR = "rgba(170,170,170,1.0)";

    var AMINO_ACID_MUTATION_FIELD_NAME = "amino_acid_mutation";

    var AMINO_ACID_KEY_FN = function(data_point) {
        var id = data_point[AMINO_ACID_MUTATION_FIELD_NAME];

        if (_.has(AMINO_ACID_MAPPING, id)) {
            return AMINO_ACID_MAPPING[id];
        }
        else {
            return id;
        }
    };

    ///////////////////////////////////////////////////////////
    // Mapping of amino acids to the groups
    //
    var LESK_AMINO_ACID_SMALL_NONPOLAR = "SMALL_NONPOLAR";
    var LESK_AMINO_ACID_HYDROPHOBIC = "HYDROPHOBIC";
    var LESK_AMINO_ACID_POLAR = "POLAR";
    var LESK_AMINO_ACID_NEGATIVELY_CHARGED = "NEGATIVELY_CHARGED";
    var LESK_AMINO_ACID_POSITIVELY_CHARGED = "POSITIVELY_CHARGED";

    var AMINO_ACID_MAPPING = {
        // Small nonpolar - G, A, S, T
        "G": LESK_AMINO_ACID_SMALL_NONPOLAR,
        "A": LESK_AMINO_ACID_SMALL_NONPOLAR,
        "S": LESK_AMINO_ACID_SMALL_NONPOLAR,
        "T": LESK_AMINO_ACID_SMALL_NONPOLAR,

        // Hydrophobic - C, V, I, L, P, F, Y, M, W
        "C": LESK_AMINO_ACID_HYDROPHOBIC,
        "V": LESK_AMINO_ACID_HYDROPHOBIC,
        "I": LESK_AMINO_ACID_HYDROPHOBIC,
        "L": LESK_AMINO_ACID_HYDROPHOBIC,
        "P": LESK_AMINO_ACID_HYDROPHOBIC,
        "F": LESK_AMINO_ACID_HYDROPHOBIC,
        "Y": LESK_AMINO_ACID_HYDROPHOBIC,
        "M": LESK_AMINO_ACID_HYDROPHOBIC,
        "W": LESK_AMINO_ACID_HYDROPHOBIC,

        // Polar - N, Q, H
        "N": LESK_AMINO_ACID_POLAR,
        "Q": LESK_AMINO_ACID_POLAR,
        "H": LESK_AMINO_ACID_POLAR,

        // Negatively charged - D, E
        "D": LESK_AMINO_ACID_NEGATIVELY_CHARGED,
        "E": LESK_AMINO_ACID_NEGATIVELY_CHARGED,

        // Positively charged - K, R
        "K": LESK_AMINO_ACID_POSITIVELY_CHARGED,
        "R": LESK_AMINO_ACID_POSITIVELY_CHARGED
    };

    ///////////////////////////////////////////////////////////
    // Mapping of the groups to colors
    //
    var AMINO_ACID_COLOR_MAP = { };
    AMINO_ACID_COLOR_MAP[LESK_AMINO_ACID_SMALL_NONPOLAR] = {label: "Small Nonpolar", color: "orange"};
    AMINO_ACID_COLOR_MAP[LESK_AMINO_ACID_HYDROPHOBIC] = {label: "Hydrophobic", color: "green"};
    AMINO_ACID_COLOR_MAP[LESK_AMINO_ACID_POLAR] = {label: "Polar", color: "magenta"};
    AMINO_ACID_COLOR_MAP[LESK_AMINO_ACID_NEGATIVELY_CHARGED] = {label: "Negatively Charged", color: "red"};
    AMINO_ACID_COLOR_MAP[LESK_AMINO_ACID_POSITIVELY_CHARGED] = {label: "Positively Charged", color: "blue"};

    return {
        data_getter: AMINO_ACID_KEY_FN,
        color_fn: function (data_point) {
            var id = AMINO_ACID_KEY_FN(data_point);
            if (_.has(AMINO_ACID_COLOR_MAP, id)) {
                return AMINO_ACID_COLOR_MAP[id];
            }
            else {
                return {label: id, color: UNKNOWN_TYPE_COLOR};
            }
        }
    };
});
