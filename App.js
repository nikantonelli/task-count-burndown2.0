Ext.define('TaskCountBurnDownChart',{
    extend: 'Rally.app.TimeboxScopedApp',
    compooinentCls: 'app',
    layout: 'fit',
    autoScroll: false,
    requires: [
        'TaskCountCalculator'
    ],

    config: {
        defaultSettings: {
            defaultScopeType: 'Iteration'
        }
    },
    launch: function() {

        //Get: Model, Current Iteration, Current Release, tasks
        Deft.Chain.parallel( [
            this._getTaskModel,
            this._getCurrentIteration,
            this._getCurrentRelease
        ]).then({
            success: function(answers) {
                this.model = answers[0];
                this._loadTasks().then({
                    success: function(tasks) {
                        this._processTasks(tasks);
                        this._addChart();
                    },
                    failure: function(e) {
                        debugger;
                        console.log(e);
                    },
                    scope: this
                });
            },
            failure: function(e) {
                debugger;
                console.log(e);

            },
            scope: this
        });
    },

    getSettingsFields: function() {
        return [
            {
                name: 'fieldcontainer',
                width: 800,
                fieldLabel: 'Timebox Type',
                defaultType: 'radiofield',
                defaults: {
                    flex: 1
                },
                layout: 'hbox',
                items: [
                    {
                        boxLabel: 'Iteration',
                        name: 'timeboxtype',
                        inputValue: 'Iteration',
                        id: 'radioIt'
                    },{
                        boxLabel: 'Release',
                        name: 'timeboxtype',
                        inputValue: 'Release',
                        id: 'radioRl'
                    }
                ]
            }
        ]
    }, 

    _getTaskModel: function() {
        return Rally.data.wsapi.ModelFactory.getModel({
            type: 'task'
        });
    },

    _getCurrentIteration: function() {
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store',{
            model: 'Iteration',
            autoLoad: true,
            filters: [
                {
                    property: 'StartDate',
                    operator: '<=',
                    value: Ext.Date.format( new Date(), "Y-m-d\\T00:00:00")
                },
                {
                    property: 'EndDate',
                    operator: '>',
                    value: Ext.Date.format( new Date(), "Y-m-d\\T23:59:59")
                }
            ],
            listeners: {
                load: function(store, records, success) {
                    if (success) {
                        if (records.length) {
                            this.currentIteration = store.getAt(0);
                        }
                        deferred.resolve(this.currentIteration);
                    }else {
                        deferred.reject('No iteration');
                    }
                }
            },
            scope: this
        });
        return deferred.promise;
    },

    _getCurrentRelease: function() {
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store',{
            model: 'Release',
            autoLoad: true,
            filters: [
                {
                    property: 'ReleaseStartDate',
                    operator: '<=',
                    value: Ext.Date.format( new Date(), "Y-m-d\\T00:00:00")
                },
                {
                    property: 'ReleaseDate',
                    operator: '>',
                    value: Ext.Date.format( new Date(), "Y-m-d\\T23:59:59")
                }
            ],
            listeners: {
                load: function(store, records, success) {
                    if (success) {
                        if (records.length) {
                            this.currentRelease = store.getAt(0);
                        }
                        deferred.resolve(this.currentRelease);
                    }
                    else {
                        deferred.reject('No Release');
                    }
                }
            },
            scope: this
        });
        return deferred.promise;
    },

    _loadTasks: function() {
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store', {
            model: 'Task',
            autoLoad: true,
            filters: this._getTaskFilters(),
            listeners: {
                load: function(store,records, success) {
                    if (success && records.length) {
                        deferred.resolve(records);
                    }
                    else {
                        deferred.reject('No Tasks');
                    }
                }
            }

        });
        return deferred.promise;
    },

    _getTaskFilters: function() {
        var filters = [];
        var scope = this._getScope();
        var selectedType = this.defaultScopeType;
        var start = Ext.Date.subtract(new Date(), Ext.Date.DAY, 140);
        var end = new Date();

        if (scope === null) {
            //Choose default setting
            var timeboxSetting = this.getSetting('timeboxtype');
            if (timeboxSetting) {
                selectedType = timeboxSetting;
            }
        }
        else {
            selectedType = scope.type
            if (selectedType === 'Milestone') {
                Rally.ui.notify.Notifier.showWarning({message: 'Milestone scoping not supported. Defaulting to'});
                selectedType = this.defaultScopeType
            }
            else {
                start = scope.record.data.StartDate;
		        end   = scope.record.data.EndDate;
            }

        }

        //selectedType should be 'Iteration' or 'Release'
        if ( selectedType === 'Iteration') {
            filters = [
                {
                    property: 'Iteration.StartDate',
                    operator: '>=',
                    value: start
                },
                {
                    property: 'Iteration.EndDate',
                    operator: '<=',
                    value: end
                }
            ]
        }
        else {
            filters = [
                {
                    property: 'Release.ReleaseStartDate',
                    operator: '>=',
                    value: start
                },
                {
                    property: 'Release.ReleaseDate',
                    operator: '<=',
                    value: end
                }
            ]
        }
        return filters;
    },

    _processTasks: function(tasks) {
        this.taskList = _.pluck(tasks, function(i) { return i.get("ObjectID");} );
    },


    _addChart: function() {
        debugger;
        var context = this.getContext();
        var modelNames = [this.model.typePath];
        var whiteListFields = [];
        var gridBoardConfig = {
            xtype: 'rallygridboard',
            toggleState: 'chart',
            chartConfig: this._getChartConfig(),
            plugins: [{
                    ptype:'rallygridboardinlinefiltercontrol',
                    showInChartMode: true,
                    inlineFilterButtonConfig: {
                        stateful: true,
                        stateId: context.getScopedStateId('filters'),
                        filterChildren: false,
                        modelNames: modelNames,
                        inlineFilterPanelConfig: {
                            quickFilterPanelConfig: {
                                defaultFields: ['Owner'],
                                addQuickFilterConfig: {
                                   whiteListFields: whiteListFields
                                }
                            },
                            advancedFilterPanelConfig: {
                               advancedFilterRowsConfig: {
                                   propertyFieldConfig: {
                                       whiteListFields: whiteListFields
                                   }
                               }
                           }
                        }
                    }
                }
            ],
            context: context,
            modelNames: modelNames,
            storeConfig: {
                filters: this._getFilters()
            }
        };
        this.add(gridBoardConfig);
    },

    _getChartConfig: function() {
        return {
            xtype: 'rallychart',
            storeType: 'Rally.data.lookback.SnapshotStore',
            storeConfig: this._getStoreConfig(),
            calculatorType: 'TaskCountCalculator',
            calculatorConfig: this._getCalculatorConfig(),
            chartConfig: this._getHCConfig()
        };
    },

    _getHCConfig: function() {
        return  {
            chart: {
                type: 'column'
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
                        color: 'white',
                        style: {
                            textShadow: '0 0 1px black'
                        }
                    }
                }
            },
            xAxis: {
                type: 'datetime',
                labels: {
                    formatter: function() {
                        debugger;
                        return Ext.Date.format( new Date(this.value), "d/m/Y");
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
                pointFormat: '{series.name}:<b>{point.y}</b><br/>',
                shared: true,
                valueDecimals : 0
            },
            legend: { align: 'center', verticalAlign: 'bottom' }
        };
    },
    _getStoreConfig: function() {
        return {
			find : {
				'ObjectID' :  {"$in" : this.taskList || [] }
			},
			pageSize:2000,
			limit: Infinity,
			fetch: ['FormattedID','ObjectID','State','Iteration','_TypeHierarchy',"_ValidFrom","_ValidTo"],
			hydrate: ['_TypeHierarchy','Iteration']
		};
    },

    _getFilters: function() {
        var queries = [],
            timeboxScope = this.getContext().getTimeboxScope();
        if (timeboxScope) {
            queries.push(timeboxScope.getQueryFilter());
        }
        if (this.getSetting('query')) {
            queries.push(Rally.data.QueryFilter.fromQueryString(this.getSetting('query')));
        }
        return queries;
    },

    _getScope: function() {
        return this.getContext().getTimeboxScope()!== undefined  ? this.getContext().getTimeboxScope() : null;
    },

    // calculator config
	_getCalculatorConfig: function() {
        var holidays = [
			//{year: 2014, month: 1, day: 1}  // Made up holiday to test knockout
		];
        return  {
            granularity: Ext.Date.DAY,
            holidays: holidays,
            workDays: 'Monday,Tuesday,Wednesday,Thursday,Friday',
            // setEndDate: new Date(extent.start).toISOString(),
            // setStartDate: new Date(extent.end).toISOString()
		};
    }
});