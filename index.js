const express = require('express');
const app = express();
const bodyParser = require('body-parser'); 
const Blockchain = require('./models/blockchain'); 
const { v1: uuid } = require('uuid');//for keys
const uniqid = require('uniqid');//for invitations
//const rp = require('request-promise');
//var path = require('path');
//var validator = require('validator');
const sha256 = require('sha256');
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;
//const http = require('http');
//var server = http.createServer(app);
//var nodemailer = require('nodemailer');
//var forge = require('node-forge');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";//fixing nodemailer

const exphbs = require('express-handlebars');
const hbs_sections = require('express-handlebars-sections');
const numeral = require('numeral');


const backup = new Blockchain();
const privateKey = uuid().split('-').join(''); //privateKey
const public_key = sha256(privateKey); //publicKey
const master = backup.createNewTransaction(1000000, "system-reward", public_key);
backup.chain[0].transactions.push(master);

///////////////////////////////////////////////////////////////////////////////////////////////
/*  -Alert: the file 'masterKeysForDelete.txt' content need to be deleted after first init-  */
fs.appendFileSync('masterKeysForDelete.txt', '\nprivateKey: ' + privateKey);
fs.appendFileSync('masterKeysForDelete.txt', '\npublicKey: ' + public_key);
/*  -Alert: the file 'masterKeysForDelete.txt' content need to be deleted after first init-  */
///////////////////////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////////////////////
/*  -Create a database named "invitationsDB" on first time-  */
///////////////////////////////////////////////////////////////////////////////////////////////
var url = "mongodb://localhost:27017/VCCOINDB";
MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    let dbo = db.db("VCCOINDB");
    dbo.collection("users").find().toArray(function (err, result) {//check if user collection already exist
        if (err) throw err;
        if (result.length !== 0)
            console.log('Collection already exist');
        else {
            console.log("Database created!");
            dbo.createCollection("users", function (err, res) {
                if (err) throw err;
                console.log("Collection created!");

                let user = {//master user
                    key: public_key,
                    inv: 1000000,
                    availableInvitations: []
                };
                //init first user in db - the master.
                dbo.collection("users").insertOne(user, function (err, res) {
                    if (err) throw err;
                    console.log("master inserted");
                    console.log(db.db("invitationsDB").listCollections());
                    db.close();
                });
            });
        }
    });
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'hbs');

app.set("views", "./views");

app.engine('hbs', exphbs({
    defaultLayout: 'index.hbs',
    extname: '.hbs',
    layoutsDir: 'views',
    helpers: {
        section: hbs_sections(),
        format(val) {
            return numeral(val).format('0,0');
        }
    }
}));

const port = 3000;

app.use(express.static('models'));
app.use(express.static('public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var server = app.listen(port, function () {
    console.log('listening to port: ' + port);
});

app.get('/', (req, res)=>{
res.render('home');
});
