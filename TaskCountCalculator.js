Ext.define("TaskCountCalculator", {
    extend: "Rally.data.lookback.calculator.TimeSeriesCalculator",
    config : {
    },


    constructor:function(config) {
        self = this;
        this.initConfig(config);
        return this;
    },

    prepareChartData: function(snapshots) {
        debugger;
    },

    getMetrics: function () {

        return [
            {
                "as": "Total",
                "field": "ObjectID",
                "display": "line",
                "f": "count"
            },
            {
                "field": "ObjectID",
                "as": "In-Progress",
                "f": "filteredCount",
                "filterField": "State",
                "filterValues": ["In-Progress"],
                "display": "column"
            },
            {
                "field": "ObjectID",
                "as": "Defined",
                "f": "filteredCount",
                "filterField": "State",
                "filterValues": ["Defined"],
                "display": "column"
            },
            {
                "field": "ObjectID",
                "as": "Completed",
                "f": "filteredCount",
                "filterField": "State",
                "filterValues": ["Completed"],
                "display": "column"
            }
        ];
    },

    getDerivedFieldsOnInput : function () {
        // XS 1, S 3, M 5, L 8, XL 13
        return [
        ];
    },

    getDerivedFieldsAfterSummary : function () {

        return [
            {
                as: 'Ideal', f: function(row, index, summaryMetrics, seriesData) {
                    // if (index===0) console.log(seriesData);
                    var maxTasks = _.max( _.pluck( seriesData, "Total"));
                    var increments = seriesData.length - 1;
                    var incrementAmount = maxTasks / increments;
                    // console.log(maxTasks,increments,incrementAmount);

                    return (100 * (maxTasks - (index * incrementAmount)) / 100);
                }
            }
        ];

    },

    defined : function(v) {
        return (!_.isUndefined(v) && !_.isNull(v));
    }
});
