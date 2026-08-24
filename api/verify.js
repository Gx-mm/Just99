// api/verify.js

export default async function handler(req, res) {
    // 1. CORS Handle karna (Taki Vercel par error na aaye)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ status: false, message: 'Sirf POST requests allow hain.' });
    }

    const { amount, utr } = req.body;

    // UTR se space ya extra characters hatana
    const cleanUtr = utr ? utr.replace(/[^0-9]/g, '') : '';

    if (!amount || !cleanUtr) {
        return res.status(400).json({ status: false, message: 'Amount aur UTR number required hain.' });
    }

    // 2. BharatPe Credentials (Apne credentials yahan dalein)
    const MERCHANT_ID = '70865902';
    const TOKEN = '1df695131cc64a57bf417b7ead5d5195';

    // 3. Date Calculate karna (Pichle 48 ghante ke liye)
    const today = new Date();
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(today.getDate() - 2);

    const sDate = twoDaysAgo.toISOString().split('T')[0];
    const eDate = today.toISOString().split('T')[0];

    // BharatPe API URL
    const apiUrl = `https://payments-tesseract.bharatpe.in/api/v1/merchant/transactions?module=PAYMENT_QR&merchantId=${MERCHANT_ID}&sDate=${sDate}&eDate=${eDate}`;

    try {
        // 4. BharatPe Server ko request bhejna
        const bharatPeResponse = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'token': TOKEN,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!bharatPeResponse.ok) {
            return res.status(500).json({ status: false, message: 'BharatPe server connection error.' });
        }

        const data = await bharatPeResponse.json();

        // 5. UTR aur Amount Match karna
        let matchedTxn = null;
        if (data && data.data && Array.isArray(data.data.transactions)) {
            matchedTxn = data.data.transactions.find(txn => txn.bankReferenceNo === cleanUtr);
        }

        if (matchedTxn) {
            const apiAmount = parseFloat(matchedTxn.amount);
            const expectedAmount = parseFloat(amount);

            if (matchedTxn.status === 'SUCCESS' && apiAmount === expectedAmount) {
                // Sahi Payment!
                return res.status(200).json({
                    status: true,
                    message: 'Payment verified successfully!',
                    data: {
                        utr: matchedTxn.bankReferenceNo,
                        amount: matchedTxn.amount,
                        sender: matchedTxn.payerName || 'Verified User'
                    }
                });
            } else {
                // Amount galat hai
                return res.status(400).json({
                    status: false,
                    message: `Amount mismatch ya payment status SUCCESS nahi hai. (Found: ₹${apiAmount})`
                });
            }
        } else {
            // UTR nahi mila
            return res.status(404).json({
                status: false,
                message: 'Yeh UTR number pichhle 48 ghanto ke records me nahi mila.'
            });
        }

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
}
  
