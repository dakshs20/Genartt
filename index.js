/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Razorpay = require('razorpay');

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Retrieve Razorpay keys from environment configuration
// IMPORTANT: These must be set using the Firebase CLI:
// In your terminal, navigate to your functions directory and run:
// firebase functions:config:set razorpay.key_id="rzp_live_Sfj1AqiaMdhJLD"
// firebase functions:config:set razorpay.key_secret="svv6GVXNhpb1S0GZ78ym5hlt"
// After setting, deploy your functions: firebase deploy --only functions
const RAZORPAY_KEY_ID = functions.config().razorpay.key_id;
const RAZORPAY_KEY_SECRET = functions.config().razorpay.key_secret;

// Ensure Razorpay keys are available
if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    functions.logger.error('Razorpay API keys are not configured. Please set them using `firebase functions:config:set razorpay.key_id="..." razorpay.key_secret="..."` and redeploy functions.');
    // Throw an error to prevent the function from running with missing credentials
    throw new Error('Razorpay API keys are not configured.');
}

const instance = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
});

exports.createRazorpayOrder = functions.https.onCall(async (data, context) => {
    functions.logger.info('createRazorpayOrder function triggered.', { data: data, auth: context.auth });

    // 1. Authentication Check
    if (!context.auth) {
        functions.logger.warn('createRazorpayOrder: Unauthenticated request.');
        throw new functions.https.HttpsError(
            'unauthenticated',
            'You must be logged in to create an order.'
        );
    }

    const userId = context.auth.uid;
    const { amount, currency, planName, credits } = data;

    // 2. Input Validation
    if (!amount || typeof amount !== 'number' || amount <= 0) {
        functions.logger.error('createRazorpayOrder: Invalid amount provided.', { amount });
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Amount must be a positive number.'
        );
    }
    if (!currency || typeof currency !== 'string' || !['INR', 'USD'].includes(currency.toUpperCase())) { // Assuming INR or USD
        functions.logger.error('createRazorpayOrder: Invalid currency provided.', { currency });
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Currency must be a valid string (e.g., "INR" or "USD").'
        );
    }
    if (!planName || typeof planName !== 'string') {
        functions.logger.error('createRazorpayOrder: Invalid planName provided.', { planName });
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Plan name is required.'
        );
    }
    if (typeof credits !== 'number' || credits < 0) {
        functions.logger.error('createRazorpayOrder: Invalid credits provided.', { credits });
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Credits must be a non-negative number.'
        );
    }

    // 3. Create Order with Razorpay
    try {
        const options = {
            amount: amount, // amount in the smallest currency unit (e.g., paisa for INR, cents for USD)
            currency: currency.toUpperCase(),
            receipt: `receipt_order_${userId}_${Date.now()}`,
            notes: {
                userId: userId,
                planName: planName,
                credits: credits,
                // Add any other relevant info
            },
            // Optional: prefill customer details if available in context.auth
            // customer_id: 'cust_xxxxxxxxxxxxxx' // If you manage customer IDs in Razorpay
        };
        functions.logger.info('createRazorpayOrder: Attempting to create Razorpay order with options:', options);
        const order = await instance.orders.create(options);
        functions.logger.info('createRazorpayOrder: Razorpay order created successfully.', { orderId: order.id });

        // 4. Store Order Details in Firestore (Optional but Recommended for tracking)
        await db.collection('razorpayOrders').doc(order.id).set({
            userId: userId,
            amount: amount,
            currency: currency.toUpperCase(),
            planName: planName,
            credits: credits,
            status: 'created',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            razorpayOrderId: order.id,
            // Add other relevant order details
        });
        functions.logger.info('createRazorpayOrder: Order details saved to Firestore.', { orderId: order.id });

        return { orderId: order.id };

    } catch (error) {
        functions.logger.error('createRazorpayOrder: Error creating Razorpay order or saving to Firestore:', error);
        // Check for specific Razorpay errors
        if (error.statusCode && error.error && error.error.code) {
            functions.logger.error(`Razorpay API Error: ${error.error.code} - ${error.error.description}`);
            throw new functions.https.HttpsError(
                'internal',
                `Razorpay API Error: ${error.error.description || 'Unknown Razorpay error.'}`
            );
        }
        // Generic error
        throw new functions.https.HttpsError(
            'internal',
            `Failed to create payment order: ${error.message || 'Unknown internal error.'}`
        );
    }
});

exports.verifyRazorpayPayment = functions.https.onCall(async (data, context) => {
    functions.logger.info('verifyRazorpayPayment function triggered.', { data: data, auth: context.auth });

    // 1. Authentication Check
    if (!context.auth) {
        functions.logger.warn('verifyRazorpayPayment: Unauthenticated request.');
        throw new functions.https.HttpsError(
            'unauthenticated',
            'You must be logged in to verify payment.'
        );
    }

    const userId = context.auth.uid;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planName, credits } = data;

    // 2. Input Validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || typeof credits !== 'number' || credits < 0) {
        functions.logger.error('verifyRazorpayPayment: Missing or invalid payment verification data.', { data });
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Missing or invalid payment verification data.'
        );
    }

    // 3. Verify Payment Signature
    try {
        const crypto = require('crypto');
        const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generated_signature = hmac.digest('hex');

        if (generated_signature === razorpay_signature) {
            functions.logger.info('verifyRazorpayPayment: Payment signature verified successfully.');

            // 4. Update User Credits in Firestore
            const userRef = db.collection('users').doc(userId);
            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) {
                    functions.logger.error('verifyRazorpayPayment: User document not found for credit update.', { userId });
                    throw new functions.https.HttpsError('not-found', 'User document not found.');
                }
                const currentCredits = userDoc.data().credits || 0;
                const newCredits = currentCredits + credits; // Add purchased credits
                transaction.update(userRef, { credits: newCredits });
                functions.logger.info(`verifyRazorpayPayment: User ${userId} credits updated from ${currentCredits} to ${newCredits}.`);
            });

            // 5. Update Order Status in Firestore (for tracking)
            const orderRef = db.collection('razorpayOrders').doc(razorpay_order_id);
            await orderRef.update({
                status: 'verified',
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature,
                verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
                creditsAdded: credits
            });
            functions.logger.info('verifyRazorpayPayment: Razorpay order status updated to verified.', { orderId: razorpay_order_id });

            return { success: true, message: 'Payment verified and credits added.' };

        } else {
            functions.logger.warn('verifyRazorpayPayment: Payment signature verification failed.', { razorpay_order_id, razorpay_payment_id, provided_signature: razorpay_signature, generated_signature });
            throw new functions.https.HttpsError(
                'unauthenticated',
                'Payment signature verification failed.'
            );
        }
    } catch (error) {
        functions.logger.error('verifyRazorpayPayment: Error during payment verification or credit update:', error);
        throw new functions.https.HttpsError(
            'internal',
            `Payment verification failed: ${error.message || 'Unknown internal error.'}`
        );
    }
});
