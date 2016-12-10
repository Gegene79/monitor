"use strict";
const API_BASEURL = "/node/api";
const TIMER_G2H = 60*1000;
const TIMER_CURRENT = 60*1000;
const TIMER_GWEEK = 5*60*1000;
const IMG_PER_PAGE = 50;
var timerGraph2hours;
var timerCurrentVal;
var timerGraphWeek;
var currentpage = 1;
var currentpagenb = 0;
var currenturl = "";
var currentquery = {};

$(function() {
    // Handler for .ready() called.

    $('#photos').click(function(){ enablephotos(); return false; });

    $('#monitor').click(function(){ enablemonitor(); return false; });

    $( '#search-btn' ).on('click',function(){
        event.preventDefault();
        let query = $('#search-text').val();
        if (query.length > 0){
            search(query);
        } else {
            browseimages();
        }
    });
    /*
        get current temperatures
    */
    function updateCurrentVal(){

        $.getJSON( API_BASEURL+"/temperature/current", function( data ) {
            $.each( data, function(key,val) {
                var id = val._id;
                var temp= parseFloat(val.value);
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

function enablephotos(){
    // stop refreshing
    clearTimeout(timerCurrentVal);
    clearTimeout(timerGraph2hours);
    clearTimeout(timerGraphWeek);

    $('#container-monitor').addClass('hidden');
    $('.nvtooltip').remove();

    $('#container-photos').removeClass('hidden');
    $('#div-search-bar').removeClass('hidden');
    $('#div-text-results').removeClass('hidden');
    $('#div-nav-pg-btn').removeClass('hidden');
    $('#scan-btn').removeClass('hidden');

    $('#monitor').parent().removeClass('active');
    $('#photos').parent().addClass('active');

    browseimages();
};

function browseimages(){
    // set url to use browse API
    currenturl = API_BASEURL + "/gallery/browseimages?limit="+IMG_PER_PAGE
    // set body to empty
    currentquery = {};
    // launch api request
    gotopage(1);
};


function search(query){
    // set url to use search API
    currenturl = API_BASEURL + "/gallery/searchimages?limit="+IMG_PER_PAGE;
    // add body with text request
    currentquery = { q: query };
    // launch api request
    gotopage(1);
};


function enablemonitor(){
    $('#container-photos').addClass('hidden');
    $('#div-search-bar').addClass('hidden');
    $('#div-text-results').addClass('hidden');
    $('#div-nav-pg-btn').addClass('hidden');
    $('#scan-btn').addClass('hidden');

    $('#container-monitor').removeClass('hidden');
    $('#monitor').parent().addClass('active');
    $('#photos').parent().removeClass('active');

    updateCurrentVal();
    loadWeekChart();
    loadHoursGraph();
};


function gotopage(pagetgt){

    let target = parseInt(pagetgt,10);
    let url = currenturl + "&skip="+(IMG_PER_PAGE*(target-1));

    $.getJSON( url, currentquery)
    .done(function( data ) {
        showresults(data,target);
    });
};

function showresults(data,page){

    $('#text-results-nb').text(data.imgcount + " Results");

    if (data.imgcount == 0){
        $('#inner-container-photos').empty();
        $('#photo-pagination').addClass('hidden');

    } else {
        currentpagenb = Math.ceil(data.imgcount/IMG_PER_PAGE);
        currentpage = page;
        updatenav(currentpagenb,currentpage);
        populateimages(data.images,data.imgcount);
    }
};


function nextpage(){

    if(currentpage < currentpagenb){
        gotopage(currentpage+1);
    } else {
        gotopage(currentpage);
    }
};

function prevpage(){

    if(currentpage > 1){
        gotopage(currentpage-1);
    } else {
        gotopage(currentpage);
    }
};

function scan(){
    $('#scan-btn').addClass('disabled');
    let url = API_BASEURL + "/gallery/scan";
    $.getJSON( url, currentquery)
    .done(function( data ) {
        $('#scan-btn').removeClass('disabled');
    });
}

function populateimages(imgarray,totalcount){

    $('#inner-container-photos').empty();

    var yearmonth = "";
    let line = 0;
    $.each( imgarray, function( i, item ) {
    
        let m = moment(item.created_at);
        m.locale('es');
        let itemyearmonth = m.format('MMMM YYYY');
        
        if (itemyearmonth != yearmonth) {
            console.log('diff');
            if (line!=0){
                $('</div>').appendTo('#line'+line);
            }
            line++;
            yearmonth = itemyearmonth;
            $('<div id="line'+line+'" class="row">').appendTo('#inner-container-photos');
            $('<div class="page-header"><h3>'+itemyearmonth+'</h3></div>').appendTo('#line'+line);
        }
        $('<div class="col-xs-6 col-md-4"> <a href="#" class="thumbnail"> \
        <img src="'+item.smallthumb+'" /> </a></div>').appendTo('#line'+line);

    });
    $('</div>').appendTo('#line'+line);
};

function updatenav(pgnumber, currentpg){
  $('.pagebtn').remove();  
// pagination
    if (pgnumber <= 15){
        for(let i=1; i <= pgnumber; i++){
            $('<li id="pg-nb-btn-'+i+'" class="pagebtn" ><a href="#">'+i+'</a></li>').insertBefore('#pg-next-btn');
            $('#pg-nb-btn-'+i).click(function(){ gotopage(i); return false; });
        }         
    } else { // more than 10 pages
        // distance pagenb - current page

        if (currentpg <= 7){
            // show 1 2 3 4 5 6 7 8 9 10 11 12 13 ... 5000
            for(let i=1; i <= 13; i++){
                $('<li id="pg-nb-btn-'+i+'" class="pagebtn" ><a href="#">'+i+'</a></li>').insertBefore('#pg-next-btn');
                $('#pg-nb-btn-'+i).click(function(){ gotopage(i); return false; });
            }
            $('#pg-nb-btn-'+currentpg).addClass("active");
            $('<li id="pg-nb-btn-dot" class="disabled pagebtn" ><a href="#">...</a></li>').insertBefore('#pg-next-btn');
            $('<li id="pg-nb-btn-'+pgnumber+'" class="pagebtn"><a href="#">'+pgnumber+'</a></li>').insertBefore('#pg-next-btn');
            $('#pg-nb-btn-'+pgnumber).click(function(){ gotopage(pgnumber); return false; });

            // until: 1 ... 3 4 5 6 7 8 9 10 11 12 13 ... 5000

        } else if (currentpg >= (pgnumber-7)){
            // show 1 ... 13 14 15 16 17 18 19 20 21 22 23
            $('<li id="pg-nb-btn-1" class="pagebtn"><a href="#">1</a></li>').insertBefore('#pg-next-btn');
            $('<li id="pg-nb-btn-dot" class="disabled pagebtn" ><a href="#">...</a></li>').insertBefore('#pg-next-btn');
            for(let i=(pgnumber-12); i <= pgnumber; i++){
                $('<li id="pg-nb-btn-'+i+'" class="pagebtn" ><a href="#">'+i+'</a></li>').insertBefore('#pg-next-btn');
                $('#pg-nb-btn-'+i).click(function(){ gotopage(i); return false; });
            }
            $('#pg-nb-btn-'+currentpg).addClass("active");
            
        } else {
            // show 1 ... 25 26 27 28 29 30 31 32 33 34 35 ... 5000
            $('<li id="pg-nb-btn-1" class="pagebtn" ><a href="#">1</a></li>').insertBefore('#pg-next-btn');
            $('<li id="pg-nb-btn-dot" class="disabled pagebtn" ><a href="#">...</a></li>').insertBefore('#pg-next-btn');
            for(let i=(currentpg-5); i <= (currentpg+5); i++){
                $('<li id="pg-nb-btn-'+i+'" class="pagebtn" ><a href="#">'+i+'</a></li>').insertBefore('#pg-next-btn');
                $('#pg-nb-btn-'+i).click(function(){ gotopage(i); return false; });
            }
            $('#pg-nb-btn-'+currentpg).addClass("active");
            $('<li id="pg-nb-btn-dot" class="disabled pagebtn" ><a href="#">...</a></li>').insertBefore('#pg-next-btn');
            $('<li id="pg-nb-btn-'+pgnumber+'" class="pagebtn" ><a href="#">'+pgnumber+'</a></li>').insertBefore('#pg-next-btn');
            $('#pg-nb-btn-'+pgnumber).click(function(){ gotopage(pgnumber); return false; });

        }
    }
    
    $('#pg-nb-btn-'+currentpg).addClass('active');
    
};


