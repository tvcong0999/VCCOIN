const express = require('express');
const app = express();
const bodyParser = require('body-parser'); 
const Blockchain = require('./models/blockchain'); 
const { v1: uuid } = require('uuid');//for keys
const uniqid = require('uniqid');//for invitations
const rp = require('request-promise');
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

// const mailer = require('nodemailer');

// var transporter = mailer.createTransport({ // config mail server
//     service: 'Gmail',
//     auth: {
//         user: 'cong123466789@gmail.com',
//         pass: 'congdeptrai15091999'
//     }
// });


const backup = new Blockchain();
const listTransaction = [];


///////////////////////////////////////////////////////////////////////////////////////////////
/*  -Alert: the file 'masterKeysForDelete.txt' content need to be deleted after first init-  */
// fs.appendFileSync('masterKeysForDelete.txt', '\nprivateKey: ' + privateKey);
// fs.appendFileSync('masterKeysForDelete.txt', '\npublicKey: ' + public_key);
/*  -Alert: the file 'masterKeysForDelete.txt' content need to be deleted after first init-  */
///////////////////////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////////////////////
/*  -Create a database named "invitationsDB" on first time-  */
///////////////////////////////////////////////////////////////////////////////////////////////
var url = "mongodb://localhost:27017/VCCOINDB";


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



app.get('/', (req, res)=>{
    res.render('home');
});


app.post('/', (req, res)=>{
    MongoClient.connect(url, function (err, db) {
        if (err) throw err;
        let privateKey = uuid().split('-').join(''); //privateKey
        let public_key = sha256(privateKey); //publicKey
        
        let dbo = db.db("VCCOINDB");
        var user = {//master user
            username: req.body.email,
            pass: req.body.password,
            publicKey: public_key,
            privateKey: privateKey,
            coin: 0,
        };
        // var mainOptions = { // thiết lập đối tượng, nội dung gửi mail
        //     from: 'Test',
        //     to: user.username,
        //     subject: 'Private Key',
        //     text: 'You recieved message from ' + 'vccoin@company.co',
        //     html: '<p>Private Key: ' + privateKey + '</p>'
        // }
        dbo.collection("users").find().toArray(function (err, result) {//check if user collection already exist
            if (err) throw err;
            if (result.length == 0)
            {
                user.coin = 1000;
                dbo.createCollection("users");
                dbo.createCollection("transactions");
                let master = backup.createNewTransaction(1000, "system-reward", public_key);
                backup.chain[0].transactions.push(master);
                dbo.collection("transactions").insertOne(master, function (err, res) {
                    if (err) throw err;
                });
            }   

            //init first user in db - the master.
            dbo.collection("users").insertOne(user, function (err, res) {
                if (err) throw err;
               db.close();
            });
        });
        // transporter.sendMail(mainOptions,function(err, info) {
        //     if (err) {
        //         console.log(err);
        //     } else {
        //         console.log('Message sent: ' + info.response);
        //     }
        // });
    });

    res.render('wallet');
})

app.post('/transaction/broadcast', (req, res)=>{
    const amount = parseFloat(req.body.amount);
    const newTransaction = backup.createNewTransaction(amount, req.body.sender, req.body.recipient);
    let flag = true;
    let sender = req.body.sender;
        /*  -Authentication: check for valid private key-  */
    if ((sender !== "system-reward") && (sender !== "system-reward: new user") && (sender !== "system-reward: invitation confirmed")) {
    
        const privateKey_Is_Valid = sha256(req.body.privKey) === req.body.sender;
    
        if (!privateKey_Is_Valid) {
    
            flag = false;
    
            res.json({
    
                note: false
    
            });
    
        }
    
        /*  -Authentication: check if user have the require amount of coins for current transaction && if user exist in the blockchain-  */
    
        const addressData = backup.getAddressData(req.body.sender);
    
        const addressData1 = backup.getAddressData(req.body.recipient);
    
        // if (addressData.addressBalance < amount || addressData === false || addressData1 === false) {
    
        //     flag = false;
    
        //     res.json({
    
        //         note: false
    
        //     });
    
        // }
    
        /*  -Authentication: fields cannot be empty-  */
    
        if (req.body.amount.length === 0 || amount === 0 || amount < 0 || req.body.sender.length === 0 || req.body.recipient.length === 0) {
    
            flag = false;
    
            res.json({
    
                note: false
    
            });
    
        }
    
    }
    
    if (amount > 0 && flag === true) {
    
        var pt = null;
    
        let transaction = backup.addTransactionToPendingTransactions(newTransaction);//put new transaction in global object
        listTransaction.push(transaction);
        MongoClient.connect(url, function (err, db) {
    
            if (err) throw err;
    
            let dbo = db.db("VCCOINDB");
    
            dbo.collection("transactions").insertOne(newTransaction, function(err, res){

                if (err) throw err;
                db.close();
            });
        });
        res.send(backup);
    }
})

app.get('/mine', (req, res) => {
    const lastBlock = backup.getLastBlock();
    const previousBlockHash = lastBlock['hash'];

    const currentBlockData = {
        transactions: backup.pendingTransactions,
        index: lastBlock['index'] + 1
    }

    const nonce = backup.proofOfWork(previousBlockHash, currentBlockData);//doing a proof of work
    const blockHash = backup.hashBlock(previousBlockHash, currentBlockData, nonce);//hash the block
    const newBlock = backup.createNewBlock(nonce, previousBlockHash, blockHash);//create a new block with params
    
    const requestOptions = {//a promise to make a new block
        uri:'http://localhost:3000/receive-new-block',
        method: 'POST',
        body: { newBlock: newBlock },
        json: true
    };
    rp(requestOptions)
        .then(data => {//reward the miner after mining succed and new block already created
            const requestOptions = {
                uri: 'http://localhost:3000/transaction/broadcast',
                method: 'POST',
                body: {
                    amount: 1,
                    sender: "system-reward",
                    recipient: req.body.public_key
                },
                json: true
            };
            return rp(requestOptions);
        })
        .then(data => {
            res.json({
                note: "New block mined and broadcast successfully",
                block: newBlock
            });
        });
});

app.post('/receive-new-block', (req, res) => {
    const newBlock = req.body.newBlock;
    const lastBlock = backup.getLastBlock();
    const correctHash = lastBlock.hash === newBlock.previousBlockHash;
    const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

    if (correctHash && correctIndex) {
        backup.chain.push(newBlock);
        backup.pendingTransactions = [];
        res.json({
            note: 'New block received and accepted.',
            newBlock: newBlock
        });
    }
    else {
        res.json({
            note: 'New block rejected',
            newBlock: newBlock
        });
    }
});

app.post('/hashKeys', (req, res) => {
    const k1 = req.body.key1;
        const k2 = req.body.key2;
        const privateKey_Is_Valid = sha256(k1) === k2;

        const addressData = backup.getAddressData(k2);
        if (addressData === false) {
            res.json({
                note: false
            });
        }

        else if (!privateKey_Is_Valid) {
            res.json({
                note: false
            });
        }
        else {
            res.json({
                note: true
            });
        }
    
});

app.post('/show-transaction', (req, res)=>{
    const data = backup.getAddressData(req.body.keySearch);
    res.send(data)
});

    /*
    * Title: emitMiningSuccess
    * Description: emit all sockets - a message to all sockets for mining operation succed
    */
    // app.get('/emitMiningSuccess', (req, res) => {
    //     io.clients().emit('mineSuccess', true);//emit to all sockets
    // });


    /*
    * Title: pendingTransactions
    * Description: get all pending Transactions
    */
    app.get('/pendingTransactions', (req, res) => {
        const transactionsData = backup.getPendingTransactions();
        res.json({
            pendingTransactions: transactionsData
        });
    });


    /*
    * Title: Main Blockchain
    * Description: display the whole block chain (Developers Only!)
    */
    app.get('/blockchain', (req, res) => {
        res.send(backup);
    });

    /*
* Title: generateKeyPair
* Description: generateKeyPair
*/
    // var keyPair = forge.pki.rsa.generateKeyPair(1024);
    // app.get('/generateKeyPair', (req, res) => {
    //     res.send(keyPair.publicKey);
    // });

    /*
    * Title: Authentication Keys
    * Description: Authentication for private and public keys
    */

var server = app.listen(port, function () {
    console.log('listening to port: ' + port);
});