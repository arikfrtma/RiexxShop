require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

// Pterodactyl API Integration
const createPterodactylServer = async (packageType) => {
  try {
    const response = await axios.post(
      `${process.env.PTERODACTYL_URL}/api/application/servers`,
      {
        name: `Server-${Date.now()}`,
        user: 1, // User ID di Pterodactyl
        egg: 1, // ID Egg
        docker_image: 'quay.io/pterodactyl/core:java',
        startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}',
        environment: {
          SERVER_JARFILE: 'server.jar',
          EULA: 'true'
        },
        limits: {
          memory: getMemoryAllocation(packageType),
          swap: 0,
          disk: 10240, // 10GB disk
          io: 500,
          cpu: 100
        },
        feature_limits: {
          databases: 0,
          allocations: 1
        },
        allocation: {
          default: 1 // Allocation ID
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PTERODACTYL_ADMIN_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Pterodactyl API Error:', error.response.data);
    throw error;
  }
};

function getMemoryAllocation(packageType) {
  const packages = {
    '1GB': 1024,
    '2GB': 2048,
    '4GB': 4096,
    '10GB': 10240,
    'Unlimited': 16384,
    'Admin Panel': 2048
  };
  return packages[packageType] || 1024;
}

// OrderKuota API Integration
app.post('/api/create-order', async (req, res) => {
  try {
    const { product, amount, email, phone, name } = req.body;
    
    const orderResponse = await axios.post(
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
    
    res.json(orderResponse.data);
  } catch (error) {
    console.error('OrderKuota API Error:', error.response.data);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Webhook for payment confirmation
app.post('/api/payment-callback', async (req, res) => {
  const { order_id, status, package } = req.body;
  
  if (status === 'success') {
    try {
      const serverDetails = await createPterodactylServer(package);
      // Here you would send credentials via email/WhatsApp
      console.log('Server created:', serverDetails);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Server creation failed:', error);
      res.status(500).send('Server creation failed');
    }
  } else {
    res.status(400).send('Payment not successful');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});