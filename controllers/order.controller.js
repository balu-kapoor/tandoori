const Order = require('../models/order.model');
const firebase = require('../db')
const firestore = firebase.firestore();
const admin = require('firebase-admin');
const moment = require('moment');
const firebase1 = require('firebase');
const stripe = require('stripe')('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');
const store = require('store');
const nodemailer = require('nodemailer');

function orderController(){
	return {
		async index(req, res) {
		const products = req.session.cart.items;
			if(!req.session.cart) {
				return res.redirect('/menu');
			}
			
			let type = req.query.type;
			const lineItems = [];
			// console.log(type);
			if(type === 'delivery' || type ==='pay_now'){
				let shipping_charges = (req.session.cart.shippingCharge) ? req.session.cart.shippingCharge : 0;
				for(let productId of Object.values(req.session.cart.items)) {	
					//Retrieve price object from stripe API:
					const price = parseFloat(productId.item.price)* 100;
					const product =	productId.item.id;
					const productName = productId.item.itemName;
					const productImage = 'test2';
					// parseFloat((19.90 * 100).toFixed(2))
					const productPrice = parseFloat((productId.item.price * 100).toFixed(2));
					const productQuantity = productId.qty;
					lineItems.push({
						price_data: {
							currency: 'aud',
							product_data: {
								name: productName,
								images: [productImage],
							},
							unit_amount: productPrice,
						},
						quantity: productQuantity,
					});
				}
                if(type === 'delivery'){
					session = await stripe.checkout.sessions.create({
						payment_method_types: ['card'],
						shipping_options: [
							{
							shipping_rate_data: {
								type: 'fixed_amount',
								fixed_amount: {
								amount: req.session.cart.shippingCharge *100,
								currency: 'aud',
								},
								display_name: 'Delivery Charges',
							}
							},
						],
						line_items: lineItems,
						mode: 'payment',
						success_url: req.protocol + '://' + req.get('host') + '/checkout/success', // => http://localhost:3000
						cancel_url: req.protocol + '://' + req.get('host') + '/checkout/'
					});
				}else if(type ==='pay_now'){
					// console.log(lineItems)
					session = await stripe.checkout.sessions.create({
						payment_method_types: ['card'],
						line_items: lineItems,
						mode: 'payment',
						success_url: req.protocol + '://' + req.get('host') + '/checkout/success', // => http://localhost:3000
						cancel_url: req.protocol + '://' + req.get('host') + '/checkout/cancel'
					});	
				}
				res.render('shop/orders', {
					path: '/checkout',
					pageTitle: 'orders',
					sessionId: session.id
				});
			}else{
				return res.redirect('/menu');
			}
		},
		async store(req, res) {
			
			let userEntity = {};
			// Validate request
			const {name, mobileNumber, email, address,city,postcode,ordertype,pickupType,shippingCharge, advance_date, advance_time,advance_order } = req.body;
			var dateObj = new Date();
			var month = dateObj.getUTCMonth() + 1; //months from 1-12
			var day = dateObj.getUTCDate();
			var year = dateObj.getUTCFullYear();
			var deliveryTiming = year+"-"+month+"-"+day+" "+dateObj.getUTCHours()+":"+dateObj.getUTCMinutes()+":"+dateObj.getUTCSeconds()+"."+Math.floor(100000 + Math.random() * 900000);
			let status = 'NEW COMING';
			if(advance_order == true) {
				req.session.advance_order = advance_order;
				req.session.advance_date = advance_date;
				req.session.advance_time = advance_time;

				status = 'ADVANCE PENDING';
				let timestamp = Date.parse(advance_date);
				let dateObject = new Date(timestamp); 
				month = dateObject.getUTCMonth() + 1; //months from 1-12
				day = dateObject.getUTCDate() + 1;
				year = dateObject.getUTCFullYear();
				deliveryTiming = year+"-"+month+"-"+day+" "+advance_time+":00"+"."+Math.floor(100000 + Math.random() * 900000);
			}
			let { cart } = req.session;
			let order_type = '';
			if(ordertype === 'pickup'){
				order_type = 'PICKUP';
			}else if(ordertype ==='delivery'){
				order_type = 'DELIVERY';
				cart.shippingCharge = parseFloat(shippingCharge);
			}
			
			if(req.cookies.tableNumber) {
				order_type = 'DINE-IN';
			}


			if(!mobileNumber) {
				req.flash('error', 'All fields are required.');
				return res.redirect('/checkout')
			}

			if(!email) {
				req.flash('error', 'Email is required.');
				return res.redirect('/checkout')
			}

			const phoneRegex = /^(\+\d{1,3}[- ]?)?\d{10}$/;
			const validPhone = phoneRegex.exec(mobileNumber);
			// Valid Phonenumber
			// if(!validPhone){
			// 	req.flash('error', 'Phone Number is not valid');
			// 	req.flash('name', name);
			// 	req.flash('mobileNumber', mobileNumber);
			// 	req.flash('address', address);
			// 	req.flash('email', email);
			// 	return res.redirect('/checkout');
			// }
			const data = req.body;
				let count = 0
let total1 = 0;
			for (let productId in req.session.cart.items) {
				count += req.session.cart.items[productId].qty;
total1 = total1 +req.session.cart.items[productId].item.price*req.session.cart.items[productId].qty;
		}
			 
			try {
				if(ordertype ==='delivery'){
					if(!city || !postcode) {
						req.flash('error', 'All fields are required.');
						return res.redirect('/checkout')
					}		
				}
				let userDocRef = firestore.collection('users').doc();
				req.session.user_id = userDocRef.id
				req.session.user = userDocRef.id;
				req.session.order = {
					orderType: order_type,
				};
				userDocRef.set({
					documentId: userDocRef.id,
					creationByUid: userDocRef.id,
					name: name,
email:email,
					mobileNumber: mobileNumber,
					address: address+','+city+','+postcode,
					creationDate: firebase1.firestore.FieldValue.serverTimestamp(),
					role: 'USER'
				})
				if(ordertype ==='pickup' && pickupType==='pay_at_counter')
				{
					const lastOneRes = await firestore.collection('orders').orderBy('creationDate', 'desc').limit(1).get();
					let ordrNo = '';
					lastOneRes.forEach(doc => {
						ordrNo = doc.data().orderNumber;
					});
					const totalPrice = total1;
					const pieces = ordrNo.split(/[\s-]+/)
					const last = pieces[pieces.length - 1]
					let increasedNum = Number(last) + 1;
					
					//newdate = year+""+month+""+day;
					
					let table_number = null;
					if(req.cookies.tableNumber) {
						table_number = req.cookies.tableNumber;
					}
					// console.log(table_number)
					var dt = new Date();
					newdate = dt.getFullYear() + '' + (((dt.getMonth() + 1) < 10) ? '0' : '') + (dt.getMonth() + 1) + '' + ((dt.getDate() < 10) ? '0' : '') + dt.getDate();
					const orderNumber = "O-"+newdate+"-0"+increasedNum;
					var orderDocRef = firestore.collection('orders').doc();	
						
					orderDocRef.set({
						collected: 'No',            
						count: count.toString(),
						createdBy: name,
						creationByUid: userDocRef.id,
						creationDate: firebase1.firestore.FieldValue.serverTimestamp(),
						customerAddress: address,
						customerName: name,
						customerEmail: email,
						customerPhoneNumber: mobileNumber,
						deliveryAmount: '',
						deliveryTiming: deliveryTiming,
						documentId: orderDocRef.id,
						orderFrom: 'WEB',
						orderNumber: orderNumber,
						orderType: req.session.order.orderType,
						paidType:'PAY AT COUNTER',
						price: totalPrice.toFixed(2),
						status: status,
						tableNumber:table_number,
						discountType: '',
						discountValue: '',
						netAmount: totalPrice.toFixed(2)
					})

				let orderItemEntity = {};
					for(let productId of Object.values(req.session.cart.items)) {	
						var total = productId.item.price * productId.qty;
						var price = parseFloat(productId.item.price);
						// if(Number.isInteger(total)){
						// 	total = total+.01;
						// }else{
							total = productId.item.price * productId.qty;
						// }

						// if(Number.isInteger(price)){
						// 	price = price+.01;
						// }else{
							price = parseFloat(productId.item.price);
						// }
						orderItemEntity['count'] = productId.qty;				
						orderItemEntity['createdBy'] = name;
						orderItemEntity['creationByUid'] = userDocRef.id;
						orderItemEntity['creationDate'] = firebase1.firestore.FieldValue.serverTimestamp();
						orderItemEntity['discount'] = null;
						orderItemEntity['name'] = productId.item.itemName;
						orderItemEntity['note'] = productId.note;
						orderItemEntity['orderId'] = orderDocRef.id;
						orderItemEntity['orderItemId'] = productId.item.id;	
						orderItemEntity['price'] = price;
						orderItemEntity['totalPrice'] = ParseFloat(total,2);
						orderItemEntity['category'] = productId.item.category;						
						 
						// const doc_id = firestore.collection("orderitems").add(orderItemEntity)
						let orderItemsDocRef = firestore.collection('orderitems').doc();
						orderItemsDocRef.set(orderItemEntity);
						orderItemEntity['documentId'] = orderItemsDocRef.id;
						firestore.collection("orderitems").doc(orderItemsDocRef.id).update(orderItemEntity);
					}
					
					await firestore.collection('users').doc(userDocRef.id).delete();
					
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
					// console.log(typeof req.session.cart.totalPrice)
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
					
					res.clearCookie("tableNumber");
					delete req.session.cart;
					if(table_number) {
						return res.redirect('/order/confirm2');
					}
					return res.redirect('/order/confirm');
				}
					let type = (ordertype ==='pickup') ? 'pay_now' : ordertype;
					return res.redirect('/customer/orders/?type='+type);
			} catch (error) {
				req.flash('error', 'Something went wrong!');
				return res.redirect('/cart');
			}
	
		},
		async show(req, res) {
			const { id } = req.params;
			const order = await Order.findById({ _id: id});
			// Authorize customer
			if(req.user._id.toString() === order.customerId.toString()) {
				return res.render('customers/singleOrder', { order });
			}
			else {
				return res.redirect('/');
			}
		}
	}
}

function ParseFloat(str,val) {
    str = str.toString();
    str = str.slice(0, (str.indexOf(".")) + val + 1); 
    return Number(str);   
}

module.exports = orderController;
