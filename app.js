require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;

// Konfigurasi OrderKuota
const ORDERKUOTA_API_KEY = '671597417363549002219753OKCT1E9C0C92AE2B811D9B21E8862D3F34C5';
const ORDERKUOTA_PRODUCT_ID = 'OK2219753';
const ORDERKUOTA_API_URL = 'https://orderkuota.id/api/transaction';

// Konfigurasi Pterodactyl
const PTERODACTYL_ADMIN_KEY = 'ptla_ZUy2AriuC9VAVfYwMmNbqvG87C71UpUXJatgiAaAflH';
const PTERODACTYL_URL = 'https://deluca.privateserverr.my.id';

// Daftar produk
const products = [
  { id: 1, name: '1GB', price: 2000, memory: 1024 },
  { id: 2, name: '2GB', price: 3000, memory: 2048 },
  { id: 3, name: '3GB', price: 4000, memory: 3072 },
  { id: 4, name: '4GB', price: 5000, memory: 4096 },
  { id: 5, name: '5GB', price: 6000, memory: 5120 },
  { id: 6, name: '6GB', price: 7000, memory: 6144 },
  { id: 7, name: '7GB', price: 8000, memory: 7168 },
  { id: 8, name: '8GB', price: 9000, memory: 8192 },
  { id: 9, name: '9GB', price: 10000, memory: 9216 },
  { id: 10, name: '10GB', price: 11000, memory: 10240 },
  { id: 11, name: 'Unlimited', price: 15000, memory: 15360 },
  { id: 12, name: 'Admin Panel', price: 20000, memory: 20480 }
];

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Simpan data order sementara (dalam produksi sebaiknya gunakan database)
let orders = {};

// Halaman utama
app.get('/', (req, res) => {
  res.render('index', { products, shopName: 'RiexxShop' });
});

// Proses pembelian
app.post('/purchase', async (req, res) => {
  const { productId, email } = req.body;
  const product = products.find(p => p.id == productId);
  
  if (!product) {
    return res.status(400).send('Produk tidak ditemukan');
  }

  const orderId = uuidv4();
  orders[orderId] = {
    product,
    email,
    status: 'pending'
  };

  try {
    // Buat transaksi di OrderKuota
    const orderkuotaResponse = await axios.post(ORDERKUOTA_API_URL, {
      api_key: ORDERKUOTA_API_KEY,
      product_id: ORDERKUOTA_PRODUCT_ID,
      custom_id: orderId,
      amount: product.price,
      customer_no: email,
      method: 'QRIS',
      note: `Pembelian ${product.name} - ${shopName}`
    });

    orders[orderId].paymentData = orderkuotaResponse.data.data;
    res.render('payment', { 
      order: orders[orderId], 
      shopName: 'RiexxShop' 
    });
  } catch (error) {
    console.error('OrderKuota error:', error.response?.data);
    res.status(500).send('Terjadi kesalahan saat memproses pembayaran');
  }
});

// Webhook untuk verifikasi pembayaran
app.post('/webhook/orderkuota', async (req, res) => {
  const { custom_id, status } = req.body;
  
  if (!orders[custom_id] || status !== 'PAID') {
    return res.status(400).send('Invalid request');
  }

  const order = orders[custom_id];
  order.status = 'paid';

  try {
    // Buat server di Pterodactyl
    await createPterodactylServer(order);
    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Pterodactyl error:', error.response?.data);
    res.status(500).send('Error creating server');
  }
});

// Halaman sukses
app.get('/success/:orderId', (req, res) => {
  const order = orders[req.params.orderId];
  if (order && order.status === 'paid') {
    res.render('success', { order, shopName: 'RiexxShop' });
  } else {
    res.status(404).send('Order tidak ditemukan atau belum dibayar');
  }
});

// Fungsi untuk membuat server di Pterodactyl
async function createPterodactylServer(order) {
  const serverConfig = {
    name: `Server-${order.product.name}-${Date.now()}`,
    user: 1, // ID user di Pterodactyl
    egg: 1,  // ID egg (game/server type)
    docker_image: "quay.io/pterodactyl/core:java",
    startup: "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}",
    environment: {
      SERVER_JARFILE: "server.jar",
      DL_PATH: ""
    },
    limits: {
      memory: order.product.memory,
      swap: 0,
      disk: order.product.memory * 2,
      io: 500,
      cpu: 100
    },
    feature_limits: {
      databases: 0,
      backups: 0
    },
    deploy: {
      locations: [1], // ID lokasi
      dedicated_ip: false,
      port_range: []
    }
  };

  const response = await axios.post(
    `${PTERODACTYL_URL}/api/application/servers`,
    serverConfig,
    {
      headers: {
        'Authorization': `Bearer ${PTERODACTYL_ADMIN_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'Application/vnd.pterodactyl.v1+json'
      }
    }
  );

  order.serverDetails = response.data;
  return response.data;
}

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});