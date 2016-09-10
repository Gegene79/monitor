$(function() {
    // Handler for .ready() called.
    var i=0;
    $.getJSON( "/api/temperature/current", function( data ) {
        $.each( data, function(key,val) {
            i++;
            var id = val._id;
            var temp= val.value;
            var ts = new Date(val.timestamp);

            if ($("#ligne1 #"+id).length){
            
                $("#ligne1 #"+id+" .temp").text(temp.toFixed(1)+"ºC");
                $("#ligne1 #"+id+" .ts").text(ts);
            
            } else {
                $("#ligne1col1").prepend("<div id="+id+" class='col-md-4'><h2>"+id+"</h2><div class='temp'><h1>"+temp.toFixed(1)+"ºC</h1></div><div class='ts'>"+ts+"</div></div>");
            }
        });
    });


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

    /*
        Main graph
    */
    d3.json("/api/temperature?sampling=30&ini="+lastweek.toISOString(), function(error, data) {	
        if (error) return console.log(error);
        console.log(data);
        
        
        nv.addGraph(function() {
            var chart = nv.models.lineWithFocusChart();

            // mapear x e y hacia las columnas
            chart.x(function(d) {
                var b = new Date(d.x).getTime();
                return b;
            });
            //chart.y(function(d) { return d.value; });
            
            // formato ejes
            chart.xAxis
                .tickValues(weekticks)
                //.staggerLabels(true)
                .tickFormat(function (d) {
                return d3.time.format('%a %d %H:%M')(new Date(d));
            });
            
            chart.x2Axis
                .tickValues(weekticks)
                //.staggerLabels(true)
                .tickFormat(function (d) {
                return d3.time.format('%d/%m %H:%M')(new Date(d));
            });

            var max = d3.max(data, function(c) { return d3.max(c.values, function(d) { return d.y; }); })+1; 
            var min = d3.min(data, function(c) { return d3.min(c.values, function(d) { return d.y; }); })-1;
            
            chart.yTickFormat(d3.format(',.1f'));
            chart.yAxis.axisLabel("ºC");
            chart.forceY([min, max]);
            
            chart.interpolate("basis");

            chart.useInteractiveGuideline(true);

            d3.select('#chart_week svg')
                .datum(data)
                .call(chart);

            nv.utils.windowResize(chart.update);

            return chart;
        });
    });

    var ini = new Date();
    ini.setHours(ini.getHours()-6,0,0,0);

    d3.json("/api/temperature?sampling=5&ini="+ini.toISOString(), function(error, data) {	
        if (error) return console.log(error);
        console.log(data);
        
        
        nv.addGraph(function() {
            var chart = nv.models.lineChart();

            // mapear x e y hacia las columnas
            chart.x(function(d) {
                var b = new Date(d.x).getTime();
                return b;
            });
            //chart.y(function(d) { return d.value; });
            
            // formato ejes
            chart.xAxis.tickFormat(function (d) {
                var a = new Date(d);
                return d3.time.format('%H:%M')(a);
            });

            var max = d3.max(data, function(c) { return d3.max(c.values, function(d) { return d.y; }); })+1; 
            var min = d3.min(data, function(c) { return d3.min(c.values, function(d) { return d.y; }); })-1;
            
            chart.yTickFormat(d3.format(',.1f'));
            chart.yAxis.axisLabel("ºC");
            chart.forceY([min, max]);
            
            chart.interpolate("basis");

            chart.useInteractiveGuideline(true);

            d3.select('#chart_6hours svg')
                .datum(data)
                .call(chart);

            nv.utils.windowResize(chart.update);

            return chart;
        });
    });

});



        

