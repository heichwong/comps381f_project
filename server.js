var express = require('express');
var session = require('cookie-session');
var bodyParser = require('body-parser');
var app = express();
var fs = require('fs');
var formidable = require('formidable');

var MongoClient = require('mongodb').MongoClient; 
var assert = require('assert');
var ObjectID = require('mongodb').ObjectID;
var mongourl = 'mongodb://dev:dev381@ds151402.mlab.com:51402/heiheiwong';

var SECRETKEY1 = 'I want to pass COMPS381F';
var SECRETKEY2 = 'Keep this to yourself';

app = express();
app.set('view engine','ejs');

app.use(session({
  name: 'session',
  keys: [SECRETKEY1,SECRETKEY2]
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

//<----------------SHOW ALL RESTAURANTS:begin
app.get('/',function(req,res) {
	console.log(req.session);
	if (!req.session.authenticated) {
		res.redirect('/login');
	} else {
		MongoClient.connect(mongourl, function(err,db){
			assert.equal(err,null);
			getDocuments(db, function(restaurants){
				db.close();
				res.render('read',{docs:restaurants});
			});
		});
	}
});

function getDocuments(db,callback){
	var restaurants = [];
	cursor = db.collection('documents').find();
	cursor.each(function(err,doc){
		assert.equal(err,null);
		if(doc!=null){
			restaurants.push(doc);
		}else{
			callback(restaurants);
		}
	});
}
//----------------------SHOW ALL RESTAURANTS:end>
//<---------------------GET RESTAURANT DETAIL:begin
app.get('/display', function(req,res){
	MongoClient.connect(mongourl, function(err,db){
		try{
			assert.equal(err,null);
		} catch(err) {
			console.log('Connection failed');
		}
		var criteria = {}
		var score = 0;
		criteria['_id'] = ObjectID(req.query._id);
		getRestaurant(db,criteria,function(restaurant){
			db.close();
			var image = new Buffer(restaurant[0].photo,'base64');
			var contentType = {};
			contentType['Content-Type'] = restaurant[0].mimetype;
			for(var i=0;i<restaurant[0].score.length;i++){
				score+=parseInt(restaurant[0].score[i]);
			}
			if(restaurant[0].user.length<1){
				score=0;
			} else {
			score=score/restaurant[0].user.length
			}
			var avgScore=score.toString()
			restaurant.push({avgScore})
			res.render('display', {docs:restaurant});
		});
	});
});

function getRestaurant(db,criteria,callback) {
	var cursor = db.collection("documents").find(criteria);
	var restaurant = [];
	cursor.each(function(err,doc){
		assert.equal(err,null);
		if (doc != null) {
			restaurant.push(doc);
		} else {
			callback(restaurant);
		}
	})
}
//----------------------GET RESTAURANT DETAIL:end>
//<---------------------REGISTER:begin
app.get('/register',function(req,res) {
	res.render('register');
});

app.post('/register',function(req,res) {
	var idpw = {};
	idpw['name'] = req.body.name;
	idpw['password'] = req.body.password;
	MongoClient.connect(mongourl,function(err,db){
		db.collection('users').insertOne(idpw,function(err,result){
			console.log("User created!\nUsername:"+idpw['name']+"\nPassword:"+idpw['password']);
		});
	});
	res.redirect('/login');
});
//----------------------REGISTER:end>
//<---------------------LOGIN:begin
app.get('/login',function(req,res) {
	res.render('login');
});

app.post('/login',function(req,res) {
	MongoClient.connect(mongourl,function(err,db){
		assert.equal(err,null);
		getUsers(db,function(users){
			db.close();
			for (var i=0; i<users.length; i++) {
				if (users[i].name == req.body.name &&
						users[i].password == req.body.password) {
					req.session.authenticated = true;
					req.session.username = users[i].name;
				}
			}
			res.redirect('/');
		});
	});
});

function getUsers(db,callback){
	var users = [];
	cursor = db.collection('users').find();
	cursor.each(function(err,doc){
		assert.equal(err,null);
		if(doc!=null){
			users.push(doc);
		}else{
			callback(users);
		}
	});
}
//-------------------LOGIN:end>
//<------------------LOGOUT:begin
app.get('/logout',function(req,res) {
	req.session = null;
	res.redirect('/');
});
//----------------------LOGOUT:end>
//<---------------------CREATE RESTAURANT:begin
app.get('/create',function(req,res) {
	res.render('create', {userName:req.session.username})
});

app.post('/create',function(req,res){
	var documents = {};
	var form = new formidable.IncomingForm();
	form.parse(req,function(err,fields,files){
		console.log(JSON.stringify(files));
		var filename = files.photo.path;
		console.log(filename);
		if (files.photo.type) {
			var mimetype = files.photo.type;
		}
		documents['name'] = fields.name;
		documents['borough'] = fields.borough;
		documents['cuisine'] = fields.cuisine;
		documents['street'] = fields.street;
		documents['building'] = fields.building;
		documents['zipcode'] = fields.zipcode;
		documents['lon'] = fields.lon;
		documents['lat'] = fields.lat;
		documents['score'] = [fields.score]; 
		if(fields.score!=""){
			documents['user'] = [req.session.username]; 
			documents['score'] = [fields.score]; 
		} else {documents['user'] = []; 
				documents['score'] = []; 
				}
		documents['owner'] = req.session.username;
		
		fs.readFile(filename,function(err,data){
			documents['mimetype'] = mimetype;
			documents['photo'] = new Buffer(data).toString('base64');
			MongoClient.connect(mongourl,function(err,db){
				db.collection('documents').insertOne(documents,function(err,result){
					console.log("Inserted!\n");
					db.close();
				});
			});
		});
	});
	res.redirect('/');
});
//---------------------CREATE RESTAURANT:end>
//<--------------------UPDATE RESTAURANT:begin
app.get('/edit', function(req,res) {
	//console.log(req.session);
		MongoClient.connect(mongourl, function(err,db){
		try{
			assert.equal(err,null);
		} catch(err) {
			console.log('Connection failed');
		}
		var criteria = {};
		criteria['name'] = req.query.name;
		getRestaurant(db,criteria,function(restaurant){
			db.close();
			var image = new Buffer(restaurant[0].photo,'base64');
			var contentType = {};
			contentType['Content-Type'] = restaurant[0].mimetype;
			if(req.session.username!=restaurant[0].owner){
				res.render('cannotEdit', {docs:restaurant});
			} else {
				res.render('edit', {docs:restaurant});
				req.session.restaurantName = req.query.name;
			}
		});
	});
});

app.post('/edit', function(req,res){
	var documents = {};
	var form = new formidable.IncomingForm();
	var criteria ={};
	var editDoc = {$set: documents}
	criteria['name'] = req.session.restaurantName;
	form.parse(req,function(err,fields,files){
		console.log(JSON.stringify(files));
		var filename = files.photo.path;
		console.log(filename);
		if (files.photo.type) {
			var mimetype = files.photo.type;
		}
		documents['name'] = fields.name;
		documents['borough'] = fields.borough;
		documents['cuisine'] = fields.cuisine;
		documents['street'] = fields.street;
		documents['building'] = fields.building;
		documents['zipcode'] = fields.zipcode;
		documents['lon'] = fields.lon;
		documents['lat'] = fields.lat;
		if(mimetype != 'application/octet-stream'){
		fs.readFile(filename,function(err,data){
			documents['mimetype'] = mimetype;
			documents['photo'] = new Buffer(data).toString('base64');
		});
		}

		MongoClient.connect(mongourl,function(err,db){
			db.collection('documents').updateOne(criteria,editDoc,function(err,res){
				if (err) throw err;
			})
				db.close();
			
		});
	});
	res.redirect('/');
});
//---------------------UPDATE RESTAURANT:end>
//<--------------------REMOVE RESTAURANT:begin
app.get('/remove', function(req, res){
	MongoClient.connect(mongourl, function(err,db){
		try{
			assert.equal(err,null);
		} catch(err) {
			console.log('Connection failed');
		}
		var criteria = {}
		var currentUser = req.session.username;
		criteria['name'] = req.query.name;
		getRestaurant(db,criteria,function(restaurant){
		if(req.session.username!=restaurant[0].owner){
			res.render('cannotEdit', {docs:restaurant});
		} else {
			res.render('remove', {docs:restaurant});
			req.session.restaurantName = req.query.name;
		}
		db.close();
		})
	})
})

app.post('/remove', function(req,res){
	MongoClient.connect(mongourl, function(err,db){
	try{
		assert.equal(err,null);
	} catch(err) {
		console.log('Connection failed');
	}
	var criteria = {};
	criteria['name'] = req.session.restaurantName;
	console.log(criteria);
	db.collection('documents').deleteOne(criteria,function(err,obj){
		if(err) throw err;
		res.redirect('/')
		})
	db.close();
	});
});
//---------------------REMOVE RESTAURANT:end>
//<--------------------RATING RESTAURANT:begin
app.get('/rate', function(req,res){
	MongoClient.connect(mongourl, function(err,db){
		try{
			assert.equal(err,null);
		} catch(err) {
			console.log('Connection failed');
		}
		var criteria = {}
		var currentUser = req.session.username;
		criteria['name'] = req.query.name;
		getRestaurant(db,criteria,function(restaurant){
		if(restaurant[0].user.indexOf(currentUser) != -1){
			res.render('rated',{docs:restaurant});
			console.log('Each user can only rate ONCE!')
		} else {
			res.render('rate',{docs:restaurant});
			req.session.restaurantName = req.query.name;
		}
		db.close();
		})
	})
})

app.post('/rate', function(req,res){
		MongoClient.connect(mongourl, function(err,db){
		try{
			assert.equal(err,null);
		} catch(err) {
			console.log('Connection failed');
		}
		var criteria = {};
		criteria['name'] = req.session.restaurantName;
		var documents = {};
		var currentUser = req.session.username;
		var score = req.body.score;
		var userRate = {$push: documents}
		documents['user'] = currentUser;
		documents['score'] = score;
		db.collection('documents').updateOne(criteria,userRate,function(err,res){
			if(err) throw err;
		})
		db.close();
});
res.redirect('/')
});
//---------------------RATING RESTAURANT:end
//<--------------------API GET:begin
app.get('/api/restaurant/name/:name', function(req,res){
	var criteria = {};
	criteria['name'] = req.params.name;
	MongoClient.connect(mongourl, function(err,db){
		try{
			assert.equal(err,null);
		} catch(err) {
			console.log('Connection failed');
		}
		getRestaurant(db,criteria,function(restaurant){
			if(restaurant != ""){
			res.status(200).json(restaurant).end()
			} else res.status(404).end('{}')
			db.close();	
		});
	})
})

app.get('/api/restaurant/borough/:borough', function(req,res){
	var criteria = {};
	criteria['borough'] = req.params.borough;
	MongoClient.connect(mongourl, function(err,db){
		try{
			assert.equal(err,null);
		} catch(err) {
			console.log('Connection failed');
		}
		getRestaurant(db,criteria,function(restaurant){
			if(restaurant != ""){
			res.status(200).json(restaurant).end()
			} else res.status(404).end('{}')
			db.close();	
		});
	})
})

app.get('/api/restaurant/cuisine/:cuisine', function(req,res){
	var criteria = {};
	criteria['cuisine'] = req.params.cuisine;
	MongoClient.connect(mongourl, function(err,db){
		try{
			assert.equal(err,null);
		} catch(err) {
			console.log('Connection failed');
		}
		getRestaurant(db,criteria,function(restaurant){
			if(restaurant != ""){
			res.status(200).json(restaurant).end()
			} else res.status(404).end('{}')
			db.close();	
		});
	})
})
//---------------------API GET:end>
//<--------------------API POST:begin 
	/*#note that the browser cannot handle POST request, 
	the json of the new restaurant would be hard coded here.*/
app.post('/api/restaurant', function(req,res){
	var newRestaurant = {
		"name": "testForAPI",
		"borough": "ouhk",
		"cuisine": "COMPS381F",
		"street": "ou",
		"building": "hk",
		"zipcode": "123",
		"lon": "123",
		"lat": "123",
		"score": [],
		"user": [],
		"owner": "student",
		"mimetype": "application/octet-stream",
		"photo": ""
	}

	MongoClient.connect(mongourl,function(err,db){
		try{
			assert.equal(err,null);
		} catch(err) {
			res.status(500).end('{\nstatus: failed\n}');
		}
		db.collection('documents').insertOne(newRestaurant,function(err,result){
			if (err) throw err;
			res.status(200).end('{\nstatus: ok, \n_id: ' + result.ops[0]._id + '\n}');
			db.close();
		});
	});
})
//---------------------API POST:end
//<--------------------SEARCH:begin
app.get('/search', function(req,res){
	res.render('search');
})

app.post('/search', function(req,res){
	var searchtext = req.body.searchtext;
	var search = req.body.search;
	var criteria = {};

	switch(search){
		case "name":
			criteria['name'] = searchtext;
			break;
		case "borough":
			criteria['borough'] = searchtext;
			break;
		case "cuisine":
			criteria['cuisine'] = searchtext;
			break;
		case "owner":
			criteria['owner'] = searchtext;
			break;
	}
	MongoClient.connect(mongourl, function(err,db){
		try{
			assert.equal(err,null);
		} catch(err) {
			console.log('Connection failed');
		}
		getRestaurant(db,criteria,function(restaurant){
			if(restaurant != ""){
			res.render('searchResult', {docs:restaurant});
			} else {
				res.render('notFound', {criteria:searchtext});
			}
			db.close();	
		});
	})
})
//---------------------SEARCH:end>

app.listen(process.env.PORT || 8099);
