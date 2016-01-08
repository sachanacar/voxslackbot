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

var url = 'https://sandbox.voxbone.com/ws-voxbone/services/rest/';
var headers = {'Accept': 'application/json','Content-type': 'application/json'};
var auth = {'user': 'voxtestsacha', 'pass': 'nxyppC2h!'}

//Search DID
function searchDid(pageNumber, pageSize, countryCodeA3, cityNamePattern, didType, featureIds, quantity){
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
            createCart(didid, quantity);
        } else {
        	console.log('could not find DID matching those criteria!');
        }
    });
}

// Create Cart
function createCart(didid, quantity){
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
            addToCart(didid, quantity, cartId);
        } else {
        	console.log('could not create cart!');
        }
    });
}

//Add to Cart
function addToCart(didid, quantity, cartId){
	var options = {
		url: url+'ordering/cart/'+cartId+'/product',
		headers: headers,
		"auth": auth,
		body: JSON.stringify({ didCartItem : {didGroupId : didid, quantity : quantity}}) 
	};
	request.post(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log('[DEBUG] - '+quantity+' DIDs of didGroup #'+didid+' added to Cart #'+ cartId);
            checkoutCart(cartId);
        } else {
        	console.log('could not add to cart!');
        }
    });
}
//Checkout Cart
function checkoutCart(cartId){
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
        	console.log("Your DID has been purchase and your order reference # is: "+body.productCheckoutList[0].orderReference);

            if (body.status == 'WARNING'){
            	console.log(body.productCheckoutList[0].message);
            };
        } else {
        	console.log('could not checkout cart!');
        }
    });
}


app.post('/', function(req, res){
	
	//Launch requests!
	// var country = req.body.country;
	// var city = req.body.city;
	// var type = req.body.didType;
	// var feature = req.body.feature;
	// var quantity = req.body.quantity;
	var country = 'USA';
	var city = 'NEW YORK';
	var type = 'GEOGRAPHIC';
	var feature = 'voxsms';
	var quantity = 1;

	if (req.body.token == '6P3xHipAHZkYezgbHHnQjGLj'){
		searchDid(0,1,country, city, type, feature, quantity);
		console.log(req.body);
	} else{
		console.log(req.body);
	}
    // console.log('POST /');
    res.setHeader('Content-Type', 'application/json');
	res.send( "yo", 200 );
    // curl -X PUT 'https://sandbox.voxbone.com/ws-voxbone/services/rest/ordering/cart' -u voxtestsacha:nxyppC2h! -H 'Content-Type: application/json' -H 'Accept: application/json' --data-binary $'{"customerReference" : "Client #12345","description" : "Cart for client #12345"}'
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});


module.exports = app;
