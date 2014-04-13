var jsdom = require('jsdom');
var redis = require('redis');
var client = redis.createClient();
var logger = require('logsimple');
var _ = require('lodash');
var mailgun = require('mailgun-js');


var MG_DOMAIN = process.env.MG_DOMAIN;
var MG_KEY = process.env.MG_KEY;
var CRAIGSLIST_FROM = process.env.CRAIGSLIST_FROM;
var CRAIGSLIST_TO = process.env.CRAIGSLIST_TO;

var mg = new mailgun({
	apiKey: MG_KEY,
	domain: MG_DOMAIN
});

var rootUrl = 'http://sfbay.craigslist.org';
var searchUrl = [rootUrl, process.argv[2]].join('/');

var key = 'CACHED_POSTS';

logger.infoCyan('scrape', 'Starting job');

var sendMail = function(newListings){
	var body = 'New listings found<br><ul>';

	_.each(newListings, function(list){
		body += '<li>' + list + '</li>';
	});
	body += '</ul>';

	mg.messages().send({
		from: CRAIGSLIST_FROM,
		to: CRAIGSLIST_TO,
		subject: 'New apartment listings',
		html: body
	}, function(err, result){
		console.log(result);
	});
};

client.get(key, function(err, res){
	var json = [];
	try {
		json = JSON.parse(res) || [];
	} catch(e){}

	jsdom.env(searchUrl, ["http://code.jquery.com/jquery.js"], function (errors, window) {
		var $ = window.$;
		var numNewListings = [];
		$(".content p.row").each(function(){
			var postId = $(this).attr('data-pid');
			var postLink = $(this).find('.i').attr('href');
			var desc = $(this).find('.pl a').html();
			var link = [rootUrl, postLink.substring(1)].join('/');
			link = '<a href="' + link + '">' + link + '</a>';

			var listingUrl = [link, desc].join(' - ');

			if(_.indexOf(json, listingUrl) < 0){
				logger.success('scrape', 'new listing found', listingUrl);
				numNewListings.push(listingUrl);
				json.push(listingUrl);
			}
		});

		if(numNewListings.length){
			sendMail(numNewListings);
		}

		client.set(key, JSON.stringify(json));
		logger.infoCyan('scrape', 'Found ' + numNewListings.length + ' new listings');
		process.exit();
	});
});