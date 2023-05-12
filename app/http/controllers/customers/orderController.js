const Order = require('../../../models/order')
const moment = require('moment')
const stripe = require('stripe')('sk_test_51N5d4qSH8sfbRYubNollZT2vVljixC2hqUiXFdRu9Im0dASNOmA8tOoA3b8tJJU1bX85gCA9pccFF5vtn2KN9znZ00YHJinaoP')
function orderController () {
    return {
        store(req, res) {
            // Validate request
            const { phone, address, stripeToken, paymentType } = req.body
            if(!phone || !address) {
                return res.status(422).json({ message : 'All fields are required' });
            }

            const order = new Order({
                customerId: req.user._id,
                items: req.session.cart.items,
                phone,
                address
            })
            order.save().then(result => {
                Order.populate(result, { path: 'customerId' }, async (err,placedOrder) => {
                    // req.flash('success','Order Placed Successfully')

                    //Stripe payment
                    if(paymentType === 'card') {
                        const paymentIntent = await stripe.paymentIntents.create({
                            amount: req.session.cart.totalPrice * 100,
                            // source: stripeToken,
                            currency: 'inr',
                            payment_method_types: ['card'],
                            description: `Food order: ${placedOrder._id}`
                        }).then(() => {
                            stripe.paymentIntents.confirm(paymentIntent.id)
                            placedOrder.paymentStatus = true;
                            placedOrder.paymentType = paymentType
                            placedOrder.save().then((ord) => {
                                // emit
                                const eventEmitter = req.app.get('eventEmitter')
                                eventEmitter.emit('orderPlaced',ord)
                                delete req.session.cart
                                return res.json({message: 'Payment successful, Order Placed Successfully'});
                            }).catch((err) => {
                                console.log(err)
                            })
                        }).catch((err) => {
                            // delete req.session.cart
                            // return res.json({message: 'Order placed but Payment failed, You can pay at delivery time'});
                            placedOrder.paymentStatus = true;
                            placedOrder.paymentType = paymentType
                            placedOrder.save().then((ord) => {
                                // emit
                                const eventEmitter = req.app.get('eventEmitter')
                                eventEmitter.emit('orderPlaced',ord)
                                delete req.session.cart
                                return res.json({message: 'Payment successful, Order Placed Successfully'});
                            })
                        })
                    }
                })
            }).catch(err => {
                return res.status(500).json({message: 'Something Went Wrong'});
            })
        },
        async index(req, res) {
            const orders = await Order.find({ customerId: req.user._id },
                null,
                { sort: { 'createdAt': -1 } } )
            res.header('Cache-Control', 'no-store')
            res.render('customers/orders', { orders: orders, moment: moment })
        },
        async show(req, res) {
            const order = await Order.findById(req.params.id)
            // Authorize user
            if(req.user._id.toString() === order.customerId.toString()) {
                return res.render('customers/singleOrder', { order })
            }
            return  res.redirect('/')
        }
    }
}

module.exports = orderController


