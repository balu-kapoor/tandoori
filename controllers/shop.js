const fs = require('fs');
const delivery = require("../data/delivery");
const category = require("../data/category");

// const admin = require("firebase-admin");
// const bucket = admin.storage().bucket('fir-pos-8e4e4.appspot.com');
const firebase = require('../db');
const Item = require('../models/item');
const nodemailer = require('nodemailer');
const Cart = require('../models/cart');
const PDFDocument = require('pdfkit');
const path = require('path');
const Category = require('../models/category');
const firestore = firebase.firestore();
const firebase1 = require('firebase');
const { check, validationResult } = require('express-validator');
const stripe = require('stripe')('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');
const store = require('store');


const getIndex = async (req, res, next) => {
    res.render('shop/index', {
        pageTitle: 'Tandoori Bistro',
        path: '/'
    });
};

const getAllItems = async (req, res, next) => {

    try {
        const items = await firestore.collection('items');
        const familyPack = await items.get();
        const familyPackArray = [];

        const categories = await firestore.collection('categories');
        const categoryItems = await categories.get();
        const categoryArray = [];

        categoryItems.forEach(doc => {
            // const cat = new Category(
            //     doc.data().categoryName,                    
            // );
            categoryArray.push(doc.data().categoryName);
            // console.log(doc.data())
        });

        familyPack.forEach(doc => {
            const family = new Item(
                doc.id,
                doc.data().category,                    
                doc.data().itemName,
                doc.data().images,
                doc.data().description,
                doc.data().isAvailable,
                doc.data().price,
                doc.data().vegetarian
            );
            familyPackArray.push(family);
        });
        // console.log(categoryArray)
        res.render('shop/product-list', {
            familyPack: familyPackArray,
            category: categoryArray,
            pageTitle: 'Tandoori Bistro',
            path: '/products',
            hasItems: familyPack.length > 0,
            activeShop: true,
            productCSS: true
        });
    } catch (error) {
        res.status(400).send(error.message);
    }
  }


const getItem = async (req, res, next) => {
  try {
      const id = req.params.id;
      const items = await firestore.collection('items').doc(id);
      const data = await items.get();
      if(!data.exists) {
          res.status(404).send('Item with the given ID not found');
      }else {
          res.send(data.data());
      }
  } catch (error) {
      res.status(400).send(error.message);
  }
}

const getTableItems = async (req, res, next) => {
    store.set('tableNumber', req.params.number)    
    try {
        const items = await firestore.collection('items');
        const familyPack = await items.get();
        const familyPackArray = [];

        const categories = await firestore.collection('categories');
        const categoryItems = await categories.get();
        const categoryArray = [];

        categoryItems.forEach(doc => {
            // const cat = new Category(
            //     doc.data().categoryName,                    
            // );
            categoryArray.push(doc.data().categoryName);
            // console.log(doc.data())
        });
       
        familyPack.forEach(doc => {
            const family = new Item(
                doc.id,
                doc.data().category,                    
                doc.data().itemName,
                doc.data().images,
                doc.data().description,
                doc.data().isAvailable,
                doc.data().price,
                doc.data().vegetarian
            );
            familyPackArray.push(family);
        });
        // console.log(categoryArray)
        res.render('shop/table-list', {
            familyPack: familyPackArray,
            category: categoryArray,
            pageTitle: 'Tandoori Bistro',
            hasItems: familyPack.length > 0,
            activeShop: true,
            productCSS: true,
        });
    } catch (error) {
        res.status(400).send(error.message);
    }
  }

const postCart = async (req, res, next) => {
    const prodId = req.body.productId;
    const items = await firestore.collection('items').doc(prodId);
    const data = await items.get();
};

const addNote = async (req, res, next) => {
    const ID = req.body.id;
    res.render('shop/add-note', {
        pageTitle: 'Shop',
        path: '/',
    });
}

const addToCart = async (req, res, next) => {
    const prodId = req.body.productId;
    const items = await firestore.collection('items').doc(prodId);
    const data = await items.get();
    Cart.save(data.data());
    res.redirect('/cart');
}

const getCart = async (req, res, next) => {
    res.render('shop/cart', { cart: Cart.getCart(), pageTitle: 'Tandoori Bistro Cart', path: '/cart', name: 'Edward' })
}

const getCheckout = async(req, res, next) => {
    if(!req.session.cart) {
        return res.redirect('/menu');
    }else if(req.session.cart && Object.values(req.session.cart.items) ==0){
        return res.redirect('/menu');
    }
    const { cart } = req.session;
    res.render('shop/checkout', { delivery: delivery, pageTitle: 'Tandoori Bistro Checkout', path: '/cart', name: 'Edward' })
};

const orderConfirm = async(req, res, next) => {
    delete req.session.cart;
    res.render('shop/confirm', { cart: Cart.getCart(), pageTitle: 'Tandoori Bistro Confirm', path: '/shop', name: '' })
};

const getCheckoutSuccess = async(req, res, next) => {
    try {
        const {name, mobileNumber, email, address,ordertype } = req.body;
        let userDocRef = firestore.collection('users').doc();
        req.session.user_id = userDocRef.id
        const ordersRef = firestore.collection('orders');
        const  id = req.session.user;
        const users = await firestore.collection('users').doc(id);
        const data = await users.get();
        const lastOneRes = await ordersRef.orderBy('creationDate', 'desc').limit(1).get();

        var orderDocRef = firestore.collection('orders').doc();
        let count = 0;
	let total = 0;
        for (let productId in req.session.cart.items) {
            count += req.session.cart.items[productId].qty;
	    total = total +req.session.cart.items[productId].item.price*req.session.cart.items[productId].qty;
        }
        let ordrNo = '';
        lastOneRes.forEach(doc => {
            ordrNo = doc.data().orderNumber;
        });

        const pieces = ordrNo.split(/[\s-]+/)
			const last = pieces[pieces.length - 1]
			let increasedNum = Number(last) + 1;
			var dateObj = new Date();
			var month = dateObj.getUTCMonth() + 1; //months from 1-12
			var day = dateObj.getUTCDate();
			var year = dateObj.getUTCFullYear();
var dt = new Date();
			newdate = dt.getFullYear() + '' + (((dt.getMonth() + 1) < 10) ? '0' : '') + (dt.getMonth() + 1) + '' + ((dt.getDate() < 10) ? '0' : '') + dt.getDate();
            		const orderNumber = "O-"+newdate+"-0"+increasedNum;
            		const totalPrice = total;
var deliveryTiming = year+"-"+month+"-"+day+" "+dateObj.getUTCHours()+":"+dateObj.getUTCMinutes()+":"+dateObj.getUTCSeconds()+"."+Math.floor(100000 + Math.random() * 900000);
let deliveryAmount = 0;
        let order_type = 'PICKUP';
        console.log(req.session.order.orderType);
        if(req.session.order.orderType === 'DELIVERY'){
            deliveryAmount = req.session.cart.shippingCharge;
            order_type = 'DELIVERY';
        }
    let table_number = '';
    if(store.get('tableNumber')) {
        table_number = store.get('tableNumber');
    }
	orderDocRef.set({
            collected: 'No',            
            count: count.toString(),
            createdBy: data.data().name,
            creationByUid: id,
            creationDate: firebase1.firestore.FieldValue.serverTimestamp(),
            customerAddress: data.data().address,
            customerName: data.data().name,
            customerEmail: data.data().email,
            customerPhoneNumber: data.data().mobileNumber,
            deliveryAmount: deliveryAmount.toString(),
	        deliveryTiming: deliveryTiming,
            documentId: orderDocRef.id,
            orderFrom: 'WEB',
            orderNumber: orderNumber,
            orderType: order_type,
            paidType:'STRIPE',
            price: totalPrice.toFixed(2),
            status: 'NEW BOOKING',
            tableNumber:table_number
        })

        let orderItemEntity = {};
        for(let productId of Object.values(req.session.cart.items)) {					
            orderItemEntity['count'] = productId.qty;				
            orderItemEntity['createdBy'] = data.data().name;
            orderItemEntity['creationByUid'] = id;
            orderItemEntity['creationDate'] = firebase1.firestore.FieldValue.serverTimestamp();
            orderItemEntity['discount'] = '';
            orderItemEntity['name'] = productId.item.itemName;
            orderItemEntity['note'] = productId.note;
            orderItemEntity['orderId'] = orderDocRef.id;
            orderItemEntity['orderItemId'] = productId.item.id;	
            orderItemEntity['price'] = productId.item.price;
orderItemEntity['totalPrice'] = ParseFloat(productId.item.price * productId.qty,2);
           firestore.collection("orderitems").add(orderItemEntity)
        }
        await firestore.collection('users').doc(id).delete();
        delete req.session.cart;
        return res.redirect('/order/confirm');
    } catch (error) {
        req.flash('error', 'Something went wrong!');
        //return res.redirect('/cart');
    }
    
  };

const getInvoice = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        const orderItems = await firestore.collection("orderitems").where("orderId", "==", 'uWdugFxWpuJ6HA9weBv6')
        .get()
        .then(function(querySnapshot) {
            const invoiceName = 'invoice-' + orderId + '.pdf';
            const invoicePath = path.join('data', 'invoices', invoiceName);

            const pdfDoc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                'inline; filename="' + invoiceName + '"'
            );
            pdfDoc.pipe(fs.createWriteStream(invoicePath));
            pdfDoc.pipe(res);

            pdfDoc.fontSize(26).text('Invoice', {
                underline: true
            });
            pdfDoc.text('-----------------------');
            let totalPrice = 0;

            querySnapshot.forEach(function(doc) {
                totalPrice += doc.data().count * doc.data().price;             
                pdfDoc
                    .fontSize(14)
                    .text(
                        doc.data().name +
                        ' - ' +
                        doc.data().count +
                        ' x ' +
                        '$' +
                        doc.data().price
                    );
            });
            pdfDoc.text('---');
            pdfDoc.fontSize(20).text('Total Price: $' + totalPrice);
            pdfDoc.end();
        })
        .catch(function(error) {
            console.log("Error getting documents: ", error);
        });
    } catch (error) {
        res.status(400).send(error.message);
    }
};

const contact = async(req, res, next) => {
    res.render('shop/contact', { cart: Cart.getCart(), pageTitle: 'Contact Indian Flavours Byford', path: '/shop', name: '' })
};

const postContact = async (req, res, next) => {
    try {
        const {contact_name, contact_email,contact_phone,contact_message } = req.body;
        
        const transporter = nodemailer.createTransport({
            host: "smtp.mailtrap.io",
            port: 2525,
            auth: {
                user: "2fc78e5f49f076",
                pass: "8b3bb2cddd0377"
            }
        })
        const mailOptions = {
            from: req.body.contact_email,
            to: 'naveen.webadsmedia@gmail.com',
            subject: `Message from ${req.body.contact_email}:  Contact Us`,
            text:req.body.contact_message,
            html: `
            <strong>Name :</strong> ${req.body.contact_name} <br/>
            <strong>Email :</strong> ${req.body.contact_email} <br/>
            <strong>Phone :</strong> ${req.body.contact_phone} <br/>
            <strong>Message :</strong>${req.body.contact_message}`
        }

        transporter.sendMail(mailOptions ,(error,info)=>{
            if(error){
                console.log(error);
                res.send('error');
            }else{
                console.log('Email Sent'+info.response);
                res.send('success');
            }
        })
        res.send('success');
    } catch (error) {
        res.status(400).send(error.message);
    }
    
};

const privacy = async(req, res, next) => {
    res.render('shop/privacy', { pageTitle: 'Tandoori Bistro Privacy Policy', path: '/shop', name: '' })
};

const postBooking = async (req, res, next) => {
    try {
        const {name, email,phone,booking_time,date,person } = req.body;
        await firestore.collection('tablebookings').doc().set({
            name:name,
            email:email,
            phone:phone,
            time:booking_time,
            date:date,
            person:person,
            creationDate: firebase1.firestore.FieldValue.serverTimestamp(),
        });
        res.send('success');
    } catch (error) {
        res.status(400).send(error.message);
    }
    
};

function ParseFloat(str,val) {
    str = str.toString();
    str = str.slice(0, (str.indexOf(".")) + val + 1); 
    return Number(str);   
}

module.exports = {
  getAllItems,
  //getAllCategories,
  getItem,
  postCart,
  postContact,
  addToCart,
  addNote,
  getCart,
  getIndex,
  getCheckout,
  getCheckoutSuccess,
  orderConfirm,
  getInvoice,
  contact,
  privacy,
  postBooking,
  getTableItems
}

