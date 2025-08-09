const axios = require('axios');

module.exports = async (req, res) => {
  try {
    const { product, amount, email, phone, name } = req.body;

    // Validasi
    if (!product || !amount || !email || !phone || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const response = await axios.post(
      'https://orderkuota.com/api/v2/order',
      {
        product_code: process.env.ORDERKUOTA_PRODUCT_CODE,
        buyer_name: name,
        buyer_email: email,
        buyer_phone: phone,
        amount: amount
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.ORDERKUOTA_API_KEY}`
        }
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error('OrderKuota API Error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to create order',
      details: error.response?.data || error.message
    });
  }
};