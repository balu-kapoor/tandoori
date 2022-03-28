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
const expirePlugin = require('store/plugins/expire');

store.addPlugin(expirePlugin);

const getIndex = async (req, res, next) => {
    res.render('shop/index', {
        pageTitle: 'Tandoori Bistro',
        path: '/'
    });
};

const getAllItems = async (req, res, next) => {
    
    if(req.cookies.tableNumber) {
        let table_number = req.cookies.tableNumber;
        res.redirect(`/table/${table_number}`);
    }    
    
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
    // store.set('tableNumber', req.params.number, 600000)    
    res.cookie('tableNumber', req.params.number, {
        expires: new Date(Date.now() + 300000),
        httpOnly: true
      });
    // console.log(req.cookies.tableNumber)
    // res.clearCookie("tableNumber");

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
    const now = new Date().getHours();
    const d = new Date();
    let day = d.getDay();
    if (!(now >= 17 && now <= 21) || (day == 1 || day== 2)) {
        return res.redirect('/cart');       
	}	
    if(!req.session.cart) {
        return res.redirect('/menu');
    }else if(req.session.cart && Object.values(req.session.cart.items) ==0){
        return res.redirect('/menu');
    }
    const { cart } = req.session;
    res.render('shop/checkout', { delivery: delivery, pageTitle: 'Tandoori Bistro Checkout', path: '/cart', name: 'Edward' })
};

const getAdvance = async(req, res, next) => {
    if(!req.session.cart) {
        return res.redirect('/menu');
    }else if(req.session.cart && Object.values(req.session.cart.items) ==0){
        return res.redirect('/menu');
    }
    const { cart } = req.session;
    res.render('shop/advance', { delivery: delivery, pageTitle: 'Tandoori Bistro Checkout', path: '/cart', name: 'Edward' })
};

const getTableCheckout = async(req, res, next) => {
    const now = new Date().getHours();
    const d = new Date();
    let day = d.getDay();
    if (!(now >= 17 && now <= 21) || (day == 1 || day== 2)) {
        return res.redirect('/cart');       
	}	
    if(!req.session.cart) {
        return res.redirect('/menu');
    }else if(req.session.cart && Object.values(req.session.cart.items) ==0){
        return res.redirect('/menu');
    }
    const { cart } = req.session;
    let table_number = null;
    if(req.cookies.tableNumber) {
        table_number = req.cookies.tableNumber;
    }
    
    res.render('shop/checkout2', { delivery: delivery, pageTitle: 'Tandoori Bistro Checkout', path: '/cart', name: 'Edward', table_number})
};

const orderConfirm = async(req, res, next) => {
    delete req.session.cart;

    
    res.render('shop/confirm', { cart: Cart.getCart(), pageTitle: 'Tandoori Bistro Confirm', path: '/shop', name: '' })
};
const orderConfirm2 = async(req, res, next) => {
    delete req.session.cart;

    let table_number = null;
    if(req.cookies.tableNumber) {
        table_number = req.cookies.tableNumber;
    }

    res.render('shop/confirm2', { cart: Cart.getCart(), pageTitle: 'Tandoori Bistro Confirm', path: '/shop', name: '', table_number })
};

const getCheckoutSuccess = async(req, res, next) => {
    try {
        const {name, mobileNumber, email, address,ordertype } = req.body;
        req.session.advance_time = advance_time;
        const advance_order = req.session.advance_order;
        
        var dateObj = new Date();
        var month = dateObj.getUTCMonth() + 1; //months from 1-12
        var day = dateObj.getUTCDate();
        var year = dateObj.getUTCFullYear();
        var deliveryTiming = year+"-"+month+"-"+day+" "+dateObj.getUTCHours()+":"+dateObj.getUTCMinutes()+":"+dateObj.getUTCSeconds()+"."+Math.floor(100000 + Math.random() * 900000);
        let status = 'NEW COMING';
        if(advance_order == true) {
            const advance_date = req.session.advance_date;
            const advance_time = req.session.advance_time;
            status = 'ADVANCE PENDING';
            let timestamp = Date.parse(advance_date);
            let dateObject = new Date(timestamp); 
            month = dateObject.getUTCMonth() + 1; //months from 1-12
            day = dateObject.getUTCDate() + 1;
            year = dateObject.getUTCFullYear();
            deliveryTiming = year+"-"+month+"-"+day+" "+advance_time+":00"+"."+Math.floor(100000 + Math.random() * 900000);
        }
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
			
            var dt = new Date();
			newdate = dt.getFullYear() + '' + (((dt.getMonth() + 1) < 10) ? '0' : '') + (dt.getMonth() + 1) + '' + ((dt.getDate() < 10) ? '0' : '') + dt.getDate();
            const orderNumber = "O-"+newdate+"-0"+increasedNum;
            const totalPrice = total;
            
        let deliveryAmount = 0;
        let order_type = 'PICKUP';
        console.log(req.session.order.orderType);
        if(req.session.order.orderType === 'DELIVERY'){
            deliveryAmount = req.session.cart.shippingCharge;
            order_type = 'DELIVERY';
        }

        
        if(req.cookies.tableNumber) {
            order_type = 'DINE-IN';
        }

    let table_number = '';
    
    if(req.cookies.tableNumber) {
        table_number = req.cookies.tableNumber;
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
            status: status,
            tableNumber:table_number,
            discountType: '',
            discountValue: '',
            netAmount: (totalPrice + deliveryAmount).toFixed(2)
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
            orderItemEntity['category'] = productId.item.category;
            orderItemEntity['totalPrice'] = ParseFloat(productId.item.price * productId.qty,2);
           
            // const doc_id = firestore.collection("orderitems").add(orderItemEntity)
            // orderItemEntity['documentId'] = doc_id.id;
            // firestore.collection("orderitems").doc(doc_id.id).update(orderItemEntity);
            let orderItemsDocRef = firestore.collection('orderitems').doc();
            orderItemsDocRef.set(orderItemEntity);
            orderItemEntity['documentId'] = orderItemsDocRef.id;
            firestore.collection("orderitems").doc(orderItemsDocRef.id).update(orderItemEntity);
        }
        await firestore.collection('users').doc(id).delete();

        // send email to customer
					let msg = `<h2>Your Order Invoice</h2>
					<h4>ABN NO: 50614499222</h4>
					<table border="1" style="border-collapse:collapse;width:100%">
					<tr>
						<th>Item Name</th>
						<th>Price</th>
						<th>Quantity</th>
					</tr>
					`;
					let t_q = req.session.cart.totalQty;
					
					for(let pizza of Object.values(req.session.cart.items)) {
						msg+=`<tr><td>${pizza.item.itemName} </td>
						<td>${pizza.item.price} </td>
						<td>${pizza.qty} </td></tr>
						` 
					}
					msg+=`<tr><td><strong>Total Price</strong></td><td>${totalPrice}</td><td></td></tr>
					<tr><td><strong>Total Quantity</strong></td><td>${t_q}</td><td></td></tr>
					<tr><td><strong>Shipping Charges</strong></td><td>${req.session.cart.shippingCharge}</td><td></td></tr>
					`;
					console.log(req.body)
					try {						
						const transporter = nodemailer.createTransport({
                            host: "smtp.gmail.com",
                            port: 587,
                            ecure: false, // true for 587, false for other ports
                            requireTLS: true,
                            auth: {
                                user: "thetandooribistro@gmail.com",
                                pass: "TandooriBistro0993@"
                            }
						})
						const mailOptions = {
							from: 'thetandooribistro@gmail.com',
							to: req.body.email,
							subject: `Message from Tandoori Bristo`,
							// text:req.body.contact_message,
							html:msg
						}
				
						transporter.sendMail(mailOptions ,(error,info)=>{
							if(error){
								console.log(error);
								// res.send('error');
							}else{
								console.log('Email Sent'+info.response);
								// res.send('success');
							}
						})
						// res.send('success');
					} catch (error) {
						res.status(400).send(error.message);
					}

        delete req.session.cart;
        delete req.session.advance_order;
        delete req.session.advance_date;
        delete req.session.advance_time;

        res.clearCookie("tableNumber");
        
        if(table_number) {
            return res.redirect('/order/confirm2');
        }
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
            host: "smtp.gmail.com",
            port: 587,
            ecure: false, // true for 587, false for other ports
            requireTLS: true,
            auth: {
                user: "thetandooribistro@gmail.com",
                pass: "TandooriBistro0993@"
            }
        })
        const mailOptions = {
            from: req.body.contact_email,
            to: 'thetandooribistro@gmail.com',
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
const formatDate = (date) => {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [year, month, day].join('-');
}
const postBooking = async (req, res, next) => {
    try {
        const {name, email,phone,booking_time,date,person, description } = req.body;
        let convert_date = formatDate(date);
        var tableDocRef = firestore.collection('tablebookings').doc();
        tableDocRef.set({
            customerName:name,
            customerPhone:phone,
            customerEmail:email,
            description:description, 
            documentId:tableDocRef.id,
            from: 'WEB',
            member:person,
            status: "WAIT FOR CONFIRMATION",
            creationDate: firebase1.firestore.FieldValue.serverTimestamp(),
            tableNumber: '',
            timing:convert_date+' '+booking_time,
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
  getTableItems,
  getTableCheckout,
  orderConfirm2,
  getAdvance
}

