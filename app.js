var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var request = require('request');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


//When ready for production change to api.voxbone.com
var url = 'https://sandbox.voxbone.com/ws-voxbone/services/rest/';
var headers = {'Accept': 'application/json','Content-type': 'application/json'};

//Add your own credentials!
var auth = {'user': 'voxtestsacha', 'pass': 'nxyppC2h!'}
app.post('/', function(req, res){
	
//Launch requests!
// /did USA, NEW YORK, GEOGRAPHIC, voxsms, 1
if (req.body.token == '6P3xHipAHZkYezgbHHnQjGLj'){
	var string = req.body.text;
	var parameters = string.split(', ');
	var country = parameters[0];
	var city = parameters[1];
	var type = parameters[2];
	var feature = parameters[3];
	var quantity = parameters[4];
	var response_url = req.body.response_url;
	searchDid(0,1,country, city, type, feature, quantity, response_url);
} else{
	res.status(200).send('You are not authorized to reach this endpoint!');
}

//Search DID
function searchDid(pageNumber, pageSize, countryCodeA3, cityNamePattern, didType, featureIds, quantity, response_url){
	var fid = getFeatureId(featureIds);
	function getFeatureId(featureIds){
		if (featureIds = null){
			fid = NULL;
		} else if (featureIds = 'voxsms'){
			fid = 25;
		} else if (featureIds = 'voxfax'){
			fid = 6;
		}
		return fid;
	};
	var options = {
		url: url+'inventory/didgroup',
		headers: headers,
		"auth": auth,
		qs : {
	        "pageNumber" : pageNumber,
	        "pageSize" : pageSize,
	        "countryCodeA3" : countryCodeA3,
	        "cityNamePattern": cityNamePattern+'%',
	        "didType": didType,
	        "featureIds": fid
    	} 
	};
	request.get(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var body = JSON.parse(body);
            var didid = body.didGroups[0].didGroupId;
            console.log('[DEBUG] - DID found: '+didid);
            createCart(didid, quantity, response_url);
        } else {
        	var body = JSON.parse(body);
        	res.setHeader('Content-Type', 'application/json');
			res.status(200).send('could not find DID matching those criteria! '+ body.errors[0].apiErrorMessage);
        }
    });
}

// Create Cart
function createCart(didid, quantity, response_url){
	var cr = Math.floor((Math.random() * 100) + 1);
	var description = "cart #: " + cr;
	var options = {
		url: url+'ordering/cart',
		headers: headers,
		"auth": auth,
		body: JSON.stringify({ customerReference : cr, description : description }) 
	};
	request.put(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
        	var body = JSON.parse(body);
            var cartId = body.cart.cartIdentifier;
        	console.log('[DEBUG] - Cart Created: #'+cartId);
            addToCart(didid, quantity, cartId, response_url);
        } else {
        	res.setHeader('Content-Type', 'application/json');
			res.status(200).send('could not create cart!');
        }
    });
}

//Add to Cart
function addToCart(didid, quantity, cartId, response_url){
	var options = {
		url: url+'ordering/cart/'+cartId+'/product',
		headers: headers,
		"auth": auth,
		body: JSON.stringify({ didCartItem : {didGroupId : didid, quantity : quantity}}) 
	};
	request.post(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log('[DEBUG] - '+quantity+' DIDs of didGroup #'+didid+' added to Cart #'+ cartId);
            checkoutCart(cartId, response_url);
        } else {
        	res.setHeader('Content-Type', 'application/json');
			res.status(200).send('could not add to cart!');
        }
    });
}

//Checkout Cart
function checkoutCart(cartId, response_url){
	var options = {
		url: url+'ordering/cart/'+cartId+'/checkout',
		headers: headers,
		"auth": auth,
		qs : {
	        "cartIdentifier" : cartId
    	} 
	};
	request.get(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
        	var body = JSON.parse(body);
            if (body.status == 'WARNING'){
            	console.log(body.productCheckoutList[0].message);
            	var message = body.productCheckoutList[0].message;
				sendResponse(message, response_url);
				res.setHeader('Content-Type', 'application/json');
				res.status(200).send('There was a problem ordering your DID.');
            } else{
        		console.log("Your DID has been purchase and your order reference # is: "+body.productCheckoutList[0].orderReference);
        		console.log(response_url);
        		var message = "Your DID has been purchase and your order reference # is: "+body.productCheckoutList[0].orderReference;
        		res.setHeader('Content-Type', 'application/json');
				res.status(200).send('DID order! Confirmation on its way.');
	        	sendResponse(message, response_url);

            };
        } else {
        	res.setHeader('Content-Type', 'application/json');
			res.status(200).send('could not checkout cart!');
        }
    });
}

function sendResponse(message, response_url){
	var options = {
		url: response_url,
		headers: headers,
		body: JSON.stringify({ text : message }) 
	};
	request.post(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
        	console.log(response);
        } else {
        	console.log(response);
        }
    });
}
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});


module.exports = app;
