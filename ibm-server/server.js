var express = require("express");
var app = express();
var cfenv = require("cfenv");
var bodyParser = require('body-parser')
var measureModel = require('./model/measure').Measure
var setupModel = require('./model/setup')

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(express.json())

let mydb, cloudant;
var vendor; // Because the MongoDB and Cloudant use different API commands, we
            // have to check which command should be used based on the database
            // vendor.
var dbName = 'weather';
var MongoObjectID;

// Separate functions are provided for inserting/retrieving content from
// MongoDB and Cloudant databases. These functions must be prefixed by a
// value that may be assigned to the 'vendor' variable, such as 'mongodb' or
// 'cloudant' (i.e., 'cloudantInsertOne' and 'mongodbInsertOne')

var insertOne = {};
var getAll = {};
var getSetup = {};
var upsertSetup = {};

insertOne.cloudant = function(doc, response) {
  mydb.insert(doc, function(err, body, header) {
    if (err) {
      console.log('[mydb.insert] ', err.message);
      response.send("Error");
      return;
    }
    doc._id = body.id;
    response.send(doc);
  });
}

getAll.cloudant = function(response) {
  var names = [];  
  mydb.list({ include_docs: true }, function(err, body) {
    if (!err) {
      body.rows.forEach(function(row) {
        if(row.doc.name)
          names.push(row.doc.name);
      });
      response.json(names);
    }
  });
  //return names;
}

function findById(id) {
  return new Promise((resolve, reject) => {
    mydb.get(id, (err, document) => {
          if (err) {
              if (err.message == 'missing') {
                  logger.warn(`Document id ${id} does not exist.`, 'findById()');
                  resolve({ data: {}, statusCode: 404 });
              } else {
                  logger.error('Error occurred: ' + err.message, 'findById()');
                  reject(err);
              }
          } else {
              resolve({ data: JSON.stringify(document), statusCode: 200 });
          }
      });
  });
}

function findByDocumentType(docType) {
  return new Promise((resolve, reject) => {
    mydb.find({
          'selector': {
              'documentType': {
                  '$eq': docType
              }
          }
      }, (err, documents) => {
          if (err) {
              reject(err);
          } else {
              resolve({ data: JSON.stringify(documents.docs), statusCode: (documents.docs.length > 0) ? 200 : 404 });
          }
      });
  });
}

https://developer.ibm.com/tutorials/learn-nodejs-node-with-cloudant-dbaas/

getSetup.cloudant = function(id, httpresponse) {
  if (typeof id !== 'undefined' && id) {
    findById(id).then((response) => {
      httpresponse.json(response.data);
    });
  } else {
    findByDocumentType('setup').then((response) => {
      if(response.statusCode == '200') {
        httpresponse.json(JSON.parse(response.data)[0]);
      } else {
        httpresponse.send();
      }
    });
  }
}

upsertSetup.cloudant = function(setup, httpresp) {
  //console.log("setup: " + JSON.stringify(setup));
  if (typeof setup.id !== 'undefined' && setup.id) {
    findById(setup.id).then((response) => {
      var doc = JSON.parse(response.data);
      //console.log("doc: " + JSON.stringify(doc));
      doc.locationName = setup.locName;
      doc.gpsLatitude = setup.gpsLat;
      doc.gpsLongitude = setup.gpsLong;
      doc.altitude = setup.alt;
      //console.log("doc 2: " + JSON.stringify(doc));
      mydb.insert(doc, function(err, body) {
        if (err) {
          console.log('[ERROR - setup update] ', err.message);
          httpresp.send("Error");
          return;
        }
        //console.log("body: " + JSON.stringify(body));
        doc._id = body.id;
        //console.log("doc 3: " + JSON.stringify(doc));
        httpresp.send(doc);
      });
    });
  } else {
    //console.log(setupModel);
    var doc = new setupModel(setup.locName, setup.gpsLat, setup.gpsLong, setup.alt);
    doc.documentType = 'setup';
    mydb.insert(doc, function(err, body) {
      if (err) {
        console.log('[ERROR - setup insert] ', err.message);
        httpresp.send("Error");
        return;
      }
      doc._id = body.id;
      httpresp.send(doc);
    });
  }
}

let collectionName = 'mycollection'; // MongoDB requires a collection name.

insertOne.mongodb = function(doc, response, collection) {
  mydb.collection(collection).insertOne(doc, function(err, body, header) {
    if (err) {
      console.log('[mydb.insertOne] ', err.message);
      response.send("Error");
      return;
    }
    //console.log(body.insertedId);
    doc._id = body.insertedId;
    response.send(doc);
  });
}

getAll.mongodb = function(response) {
  var names = [];
  mydb.collection(collectionName).find({}, {fields:{_id: 0, count: 0}}).toArray(function(err, result) {
    if (!err) {
      result.forEach(function(row) {
        names.push(row.name);
      });
      response.json(names);
    }
  });
}

getSetup.mongodb = function(id, response) {
  //console.log(id);
  var setup = {};
  var filter = {};
  if (typeof id !== 'undefined' && id) {
    filter = {'_id': MongoObjectID(id)};
  }
  //console.log(filter);
  mydb.collection("setup").findOne(filter, function(err, result) {
    if (!err) {
      //console.log(result);
      setup = result;
      //console.log(setup);
      response.json(setup);
    }
  });
}

upsertSetup.mongodb = function(setup, resp) {
  var filter = {};
  //console.log(setup);
  var update = { $set: new setupModel(setup.locName, setup.gpsLat, setup.gpsLong, setup.alt) };
  //console.log(update);
  var id = setup.id;
  if (typeof id !== 'undefined' && id) {
    filter = {'_id': MongoObjectID(id)};
  }
  //console.log(filter);
  mydb.collection("setup").findOneAndUpdate(filter, update, { upsert: true, new: true }, function(err, result) {
    if (!err) {
      //console.log(result);
      resp.json(result.value);
    }
  });
}

/* Endpoint to greet and add a new visitor to database.
* Send a POST request to localhost:3000/api/visitors with body
* {
*   "name": "Bob"
* }
*/
app.post("/api/visitors", function (request, response) {
  var userName = request.body.name;
  var doc = { "name" : userName };
  if(!mydb) {
    console.log("No database.");
    response.send(doc);
    return;
  }
  insertOne[vendor](doc, response);
});

/**
 * Endpoint to get a JSON array of all the visitors in the database
 * REST API example:
 * <code>
 * GET http://localhost:3000/api/visitors
 * </code>
 *
 * Response:
 * [ "Bob", "Jane" ]
 * @return An array of all the visitor names
 */
app.get("/api/visitors", function (request, response) {
  var names = [];
  if(!mydb) {
    response.json(names);
    return;
  }
  getAll[vendor](response);
});

app.get("/api/weather/setup", function(req, resp) {
  var id = req.body.setupId;
  var data = [];
  if(!mydb) {
    response.json(data);
    return;
  }
  getSetup[vendor](id, resp);
});

app.post("/api/weather/setup", function (request, response) {
  var id = request.body.id;
  var locName = request.body.locName;
  var gpsLat = request.body.gpsLat;
  var gpsLong = request.body.gpsLong;
  var alt = request.body.altitude;
  var doc = { "id": id, "locName" : locName, "gpsLat": gpsLat, "gpsLong": gpsLong, "alt": alt };
  if(!mydb) {
    console.log("No database.");
    response.send(doc);
    return;
  }
  upsertSetup[vendor](doc, response);
});

app.post("/api/weather/measure", function (request, response) {
  console.log(request.body);
  console.log(request.body.measures);
  var measures = request.body.measures;
  var doc = new measureModel(measures.humidity, measures.temparature, measures.pressure, measures.altitude, measures.epochTime);
  if(!mydb) {
    console.log("No database.");
    response.send(doc);
    return;
  }
  insertOne[vendor](doc, response, "measure");
});

// load local VCAP configuration  and service credentials
var vcapLocal;
try {
  vcapLocal = require('./vcap-local.json');
  // vcapLocal = require('./vcap-local.MongoDBexample.json');
  console.log("Loaded local VCAP", vcapLocal);
} catch (e) { }

const appEnvOpts = vcapLocal ? { vcap: vcapLocal} : {}

const appEnv = cfenv.getAppEnv(appEnvOpts);

if (appEnv.services['compose-for-mongodb'] || appEnv.getService(/.*[Mm][Oo][Nn][Gg][Oo].*/)) {
  // Load the MongoDB library.
  var MongoClient = require('mongodb').MongoClient;
  MongoObjectID = require('mongodb').ObjectID;

  // Initialize database with credentials
  if (appEnv.services['compose-for-mongodb']) {
    MongoClient.connect(appEnv.services['compose-for-mongodb'][0].credentials.uri, { useNewUrlParser: true }, function(err, db) {
      if (err) {
        console.log(err);
      } else {
        mydb = db.db(dbName);
        console.log("Created database: " + dbName);
      }
    });
  } else {
    // user-provided service with 'mongodb' in its name
    MongoClient.connect(appEnv.getService(/.*[Mm][Oo][Nn][Gg][Oo].*/).credentials.uri, null,
      function(err, db) {
        if (err) {
          console.log(err);
        } else {
          mydb = db.db(dbName);
          console.log("Created database: " + dbName);
        }
      }
    );
  }

  vendor = 'mongodb';
} else if (appEnv.services['cloudantNoSQLDB'] || appEnv.getService(/[Cc][Ll][Oo][Uu][Dd][Aa][Nn][Tt]/)) {
  // Load the Cloudant library.
  var Cloudant = require('@cloudant/cloudant');

  // Initialize database with credentials
  if (appEnv.services['cloudantNoSQLDB']) {
    // CF service named 'cloudantNoSQLDB'
    cloudant = Cloudant(appEnv.services['cloudantNoSQLDB'][0].credentials);
  } else {
     // user-provided service with 'cloudant' in its name
     cloudant = Cloudant(appEnv.getService(/cloudant/).credentials);
  }
} else if (process.env.CLOUDANT_URL){
  cloudant = Cloudant(process.env.CLOUDANT_URL);
}
if(cloudant) {

  // Create a new "mydb" database.
  cloudant.db.create(dbName, function(err, data) {
    if(!err) //err if database doesn't already exists
      console.log("Created database: " + dbName);
  });


  // Specify the database we are going to use (mydb)...
  mydb = cloudant.db.use(dbName);

  vendor = 'cloudant';
}

//serve static file (index.html, images, css)
app.use(express.static(__dirname + '/views'));



var port = process.env.PORT || 3000
app.listen(port, function() {
    console.log("To view your app, open this link in your browser: http://localhost:" + port);
});
