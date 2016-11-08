var API_BASEURL = "/node/api";
var TIMER_G2H = 60*1000;
var TIMER_CURRENT = 60*1000;
var TIMER_GWEEK = 5*60*1000;
var timerGraph2hours;
var timerCurrentVal;
var timerGraphWeek;



$(function() {
    // Handler for .ready() called.


    /*
        get current temperatures
    */
    function updateCurrentVal(){

        $.getJSON( API_BASEURL+"/temperature/current", function( data ) {
            $.each( data, function(key,val) {
                var id = val._id;
                var temp= parseInt(val.value);
                var ts = new Date(val.timestamp);
                
                if ($("#ligne1 #"+id).length){ // if the box exists, update data only.
                
                    $("#ligne1 #"+id+" .temp h1").text(temp.toFixed(1)+"ºC");
                    $("#ligne1 #"+id+" .ts").text(ts);
                
                } else { // otherwise insert box in the DOM
                    $("#ligne1col1").prepend("<div id="+id+" class='col-md-4'><h2>"+id+"</h2><div class='temp'><h1>"+temp.toFixed(1)+"ºC</h1></div><div class='ts'>"+ts+"</div></div>");
                }
            });
        });

        timerCurrentVal = setTimeout(updateCurrentVal, TIMER_CURRENT);
    }

    updateCurrentVal();

    

    /*
        Main graph
    */
    

    var chartWeek = nv.models.lineWithFocusChart();

    // mapear x e y hacia las columnas
    chartWeek.x(function(d) {
        var b = new Date(d.x).getTime();
        return b;
    });
    //chart.y(function(d) { return d.value; });
    // formato ejes
    chartWeek.xAxis
        //.staggerLabels(true)
        .tickFormat(function (d) {
        return d3.time.format('%a %d %H:%M')(new Date(d));
    });
    
    chartWeek.x2Axis
        //.staggerLabels(true)
        .tickFormat(function (d) {
        return d3.time.format('%d/%m %H:%M')(new Date(d));
    });

    chartWeek.yTickFormat(d3.format(',.1f'));
    chartWeek.yAxis.axisLabel("ºC");
    
    chartWeek.interpolate("basis");

    chartWeek.useInteractiveGuideline(true);

    function loadHoursGraph(){
        var now = new Date();
        var lastweek = new Date();
        lastweek.setHours(-24*7,0,0,0);
        

        var weekticks = [];
        var s = new Date(lastweek);// new Date($('#hfEventStartDate').val() - 0);
        while(s.valueOf() < now.valueOf()) {
            weekticks.push(s);
            s = new Date(s.setDate(
                s.getDate() + 1
            ));
        }

        chartWeek.xAxis.tickValues(weekticks);
        chartWeek.x2Axis.tickValues(weekticks);

        d3.json(API_BASEURL+"/temperature?sampling=30&ini="+lastweek.toISOString(), function(error, data) {	
            if (error) return console.log(error);

            var max = d3.max(data, function(c) { return d3.max(c.values, function(d) { return d.y; }); })+1; 
            var min = d3.min(data, function(c) { return d3.min(c.values, function(d) { return d.y; }); })-1;
            chartWeek.forceY([min, max]);
            
            d3.select('#chart_week svg')
                .datum(data)
                .call(chartWeek);

            nv.utils.windowResize(chartWeek.update);
        });
        
        timerGraph2hours = setTimeout(loadHoursGraph, TIMER_G2H);
        return chartWeek;
        
    }
    
    nv.addGraph(loadHoursGraph);


     /*
        6 Hours graph
    */

    var chartG6H = nv.models.lineChart();

    // mapear x e y hacia las columnas
    chartG6H.x(function(d) {
        var b = new Date(d.x).getTime();
        return b;
    });
    //chart.y(function(d) { return d.value; });
    
    // formato ejes
    chartG6H.xAxis.tickFormat(function (d) {
        var a = new Date(d);
        return d3.time.format('%H:%M')(a);
    });

    chartG6H.yTickFormat(d3.format(',.1f'));
    chartG6H.yAxis.axisLabel("ºC");

    chartG6H.interpolate("basis");
    chartG6H.useInteractiveGuideline(true);


    function loadWeekChart() {
        var ini = new Date();
        ini.setHours(ini.getHours()-6,0,0,0);

        d3.json(API_BASEURL+"/temperature?sampling=5&ini="+ini.toISOString(), function(error, data) {

            var max = d3.max(data, function(c) { return d3.max(c.values, function(d) { return d.y; }); })+1; 
            var min = d3.min(data, function(c) { return d3.min(c.values, function(d) { return d.y; }); })-1;
            chartG6H.forceY([min, max]);

            d3.select('#chart_6hours svg')
                    .datum(data)
                    .call(chartG6H);
        
            nv.utils.windowResize(chartG6H.update);
        });
        timerGraphWeek = setTimeout(loadWeekChart, TIMER_GWEEK);
        return chartG6H;
    };

    nv.addGraph(loadWeekChart);

    

});

