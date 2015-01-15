var app = null;

Ext.define('CustomApp', {
    extend: 'Rally.app.TimeboxScopedApp',
    componentCls: 'app',
    scopeType : 'iteration',
    items:{ html:'<a href="https://help.rallydev.com/apps/2.0rc3/doc/">App SDK 2.0rc3 Docs</a>'},
    launch: function() {
        //Write app code here
        app = this;

        var testScope = { 
        	record : {
				data : {
					Name : "Iteration 3",
					StartDate : new Date(2015,0,1),
					EndDate : new Date(2015,0,31)
				}
			}
		};

        var scope = app.getContext().getTimeboxScope()!== undefined 
            ? app.getContext().getTimeboxScope()
            : testScope;

        app.reload(scope);

    },

    reload : function(scope) {

        app.loadTasks(scope,function(tasks){
            app.loadTaskSnapshots(tasks,function(snapshots) {
                app.createChartData(snapshots,scope,function(hc){
                    app.showChart(hc);
                })
            });
        });
    },

    onScopeChange : function(scope) {
        app.reload(scope);
    },

    getScopeExtent : function( scope ) {

        var start = scope.record.data.StartDate;
        var end   = scope.record.data.EndDate;
        var isoStart  = Rally.util.DateTime.toIsoString(start, false);
        var isoEnd    = Rally.util.DateTime.toIsoString(end, false);

        return { start : start, end : end, isoStart : isoStart, isoEnd : isoEnd };

    },

    loadTasks : function ( scope, callback ) {

    	Ext.create('Rally.data.WsapiDataStore', {
        	autoLoad : true,
        	limit : "Infinity",
        	model : "Task",
        	fetch : ["ObjectID"],
        	filters : {property : app.scopeType + ".Name",operator:"=",value:scope.record.data.Name},
	        listeners : {
	            scope : this,
	            load : function(store, data) {
	                callback(data);
	            }
	        }
    	});
    },

    loadTaskSnapshots : function( tasks,callback ) {

        var ids = _.pluck(tasks, function(i) { return i.get("ObjectID");} );

        var storeConfig = {
            find : {
                'ObjectID' :  {"$in" : ids}
            },
            autoLoad : true,
            pageSize:1000,
            limit: 'Infinity',
            fetch: ['FormattedID','ObjectID','State','Iteration','_TypeHierarchy',"_ValidFrom","_ValidTo"],
            hydrate: ['_TypeHierarchy','Iteration']
        };

        storeConfig.listeners = {
            scope : this,
            load: function(store, snapshots, success) {
                callback(snapshots);
            }
        };

        var snapshotStore = Ext.create('Rally.data.lookback.SnapshotStore', storeConfig);

    },

    createTimeBoxFilter : function ( timeboxes ) {
        var filter = null;

        _.each( timeboxes, function( tb, i ) {
			var f = Ext.create('Rally.data.wsapi.Filter', {
				property : app.scopeType + ".ObjectID", operator : '=', value : ""+tb.get("ObjectID") }
			);
            filter = (i===0) ? f : filter.or(f);
        });
        return filter;
    },


    createChartData : function ( snapshots, scope, callback ) {
        
        var that = this;
        var lumenize = window.parent.Rally.data.lookback.Lumenize;
        // var lumenize = Ext.create("Rally.data.lookback.Lumenize",{});

        var snapShotData = _.map(snapshots,function(d){return d.data;});
        var extent = app.getScopeExtent(scope);

        var holidays = [
            //{year: 2014, month: 1, day: 1}  // Made up holiday to test knockout
        ];

        var myCalc = Ext.create("TaskCountCalculator", {});

        // calculator config
        var config = {
            deriveFieldsOnInput: myCalc.getDerivedFieldsOnInput(),
            metrics: myCalc.getMetrics(),
            summaryMetricsConfig: [],
            deriveFieldsAfterSummary: myCalc.getDerivedFieldsAfterSummary(),
            granularity: lumenize.Time.DAY,
            tz: 'America/New_York',
            holidays: holidays,
            workDays: 'Monday,Tuesday,Wednesday,Thursday,Friday'
        };
        // release start and end dates
        var startOnISOString = new lumenize.Time(extent.start).getISOStringInTZ(config.tz);
        var upToDateISOString = new lumenize.Time(extent.end).getISOStringInTZ(config.tz);
        // create the calculator and add snapshots to it.
        calculator = new lumenize.TimeSeriesCalculator(config);
        calculator.addSnapshots(snapShotData, startOnISOString, upToDateISOString);
        
        // create a high charts series config object, used to get the hc series data
        var hcConfig = [{ name : "label" },{ name : "Ideal", type : "line"}];
        _.each( myCalc.getMetrics(), function(m) {
            hcConfig.push({
               name : m.as, type : m.display, visible : ( m.as === "Completed" ? false : true )
            });
        });
        var hc = lumenize.arrayOfMaps_To_HighChartsSeries(calculator.getResults().seriesData, hcConfig);
        // callback(hc);
        app.showChart( app.trimHighChartsConfig(hc));
    },

    trimHighChartsConfig : function( hc ) {
        var today = new Date();
        _.each(hc, function(series,i) {
        // for non-projection values dont chart after today
            if (series.name.indexOf("Ideal")===-1 && series.name.indexOf("label") ===-1 && series.name.indexOf("Total") === -1  ) {
                _.each( series.data, function( point , x ){
                    if ( Date.parse(hc[0].data[x]) > today )
                        series.data[x] = null;
                });
            }
        })

        return hc;
    },


    showChart : function(series) {

        var that = this;
        
        var chart = this.down("#chart1");
        if (chart !== null)
            chart.removeAll();
            
        
        // set the tick interval
        var tickInterval = series[1].data.length <= (7*20) ? 7 : (series[1].data.length / 20);

        var extChart = Ext.create('Rally.ui.chart.Chart', {
            columnWidth : 1,
            itemId : "chart1",
            chartData: {
                categories : series[0].data,
                series : series.slice(1, series.length)
            },

            chartColors : ["LightGray","Black","LightBlue"],

            chartConfig : {
                chart: {
                },
                title: {
                text: 'Task Burndown',
                x: -20 //center
                },
                plotOptions: {
                    series: {
                        marker: {
                            radius: 2
                        }
                    },
                    column: {
		                stacking: 'normal',
		                dataLabels: {
		                    enabled: true,
		                    color: (Highcharts.theme && Highcharts.theme.dataLabelsColor) || 'white',
		                    style: {
		                        textShadow: '0 0 1px black'
		                    }
		                }
	            	}
                },
                xAxis: {
                    // plotLines : plotlines,
                    //tickInterval : 7,
                    tickInterval : tickInterval,
                    type: 'datetime',
                    labels: {
                        formatter: function() {
                            return Highcharts.dateFormat('%b %d', Date.parse(this.value));
                        }
                    }
                },
                yAxis: {
                    title: {
                        text : 'Task Count'
                    },
                    plotLines: [{
                        value: 0,
                        width: 1,
                        color: '#808080'
                    }]
                },
                tooltip: {
                },
                legend: { align: 'center', verticalAlign: 'bottom' }
            }
        });
        this.add(extChart);
        chart = this.down("#chart1");
        var p = Ext.get(chart.id);
        elems = p.query("div.x-mask");
        _.each(elems, function(e) { e.remove(); });
        var elems = p.query("div.x-mask-msg");
        _.each(elems, function(e) { e.remove(); });

    }

});

