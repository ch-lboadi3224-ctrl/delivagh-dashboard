# Add MoMo Number Field to Dashboard

## Where to Add

In the **Business Settings** or **Profile** section of the vendor dashboard (App.jsx).

## What to Add

### 1. Add State Variable
```javascript
const [momoNumber, setMomoNumber] = useState("");
```

### 2. Fetch MoMo Number on Load
```javascript
// In the function that fetches business data
const { data: biz } = await supabase
    .from('businesses')
    .select('name, contact_number, momo_number')  // Add momo_number here
    .eq('user_id', user.id)
    .single();

if (biz) {
    setBusinessName(biz.name);
    setContactNumber(biz.contact_number || "");
    setMomoNumber(biz.momo_number || "");  // Add this line
}
```

### 3. Add Input Field in Settings UI
```jsx
{/* Add this after the contact_number field */}
<div style={{ marginBottom: "20px" }}>
    <label style={{ 
        display: "block", 
        fontSize: "13px", 
        fontWeight: "600", 
        color: d.muted, 
        marginBottom: "8px" 
    }}>
        MoMo Number for Payments
    </label>
    <input
        type="tel"
        placeholder="024XXXXXXX"
        value={momoNumber}
        onChange={(e) => setMomoNumber(e.target.value)}
        style={{
            width: "100%",
            padding: "12px 16px",
            background: d.input,
            border: `1px solid ${d.inputBorder}`,
            borderRadius: "10px",
            fontSize: "14px",
            color: d.text,
            outline: "none",
            boxSizing: "border-box"
        }}
    />
    <small style={{ 
        display: "block", 
        marginTop: "6px", 
        fontSize: "12px", 
        color: d.muted 
    }}>
        This number will be shown to customers for direct MoMo payments (separate from contact number)
    </small>
</div>
```

### 4. Save MoMo Number
```javascript
// In the save settings function
async function saveBusinessSettings() {
    try {
        const { error } = await supabase
            .from('businesses')
            .update({
                contact_number: contactNumber,
                momo_number: momoNumber,  // Add this line
                // ... other fields
            })
            .eq('user_id', user.id);
        
        if (error) throw error;
        
        addNotif("Settings saved successfully!");
    } catch (e) {
        addNotif("Failed to save settings: " + e.message, "error");
    }
}
```

## Display Screenshot in Orders

### Add to Order Details Modal/View

```jsx
{/* Add this in the order details section */}
{selectedOrder?.payment_method === 'manual_momo' && selectedOrder?.payment_screenshot_url && (
    <div style={{ marginTop: "16px", padding: "16px", background: d.bg3, borderRadius: "10px" }}>
        <label style={{ 
            display: "block", 
            fontSize: "13px", 
            fontWeight: "600", 
            color: d.muted, 
            marginBottom: "8px" 
        }}>
            Payment Screenshot:
        </label>
        <a 
            href={selectedOrder.payment_screenshot_url} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ display: "block" }}
        >
            <img 
                src={selectedOrder.payment_screenshot_url} 
                alt="Payment screenshot" 
                style={{ 
                    maxWidth: "100%", 
                    maxHeight: "400px", 
                    borderRadius: "8px",
                    border: `1px solid ${d.border}`
                }} 
            />
        </a>
        <small style={{ 
            display: "block", 
            marginTop: "8px", 
            fontSize: "12px", 
            color: d.muted 
        }}>
            Click to view full size
        </small>
    </div>
)}
```

## Add Customer Notification When Marked as Paid

### In the "Mark as Paid" Button Handler

```javascript
async function markOrderAsPaid(orderId) {
    try {
        // Update order status
        const { error } = await supabase
            .from('orders')
            .update({ payment_status: 'paid' })
            .eq('id', orderId);
        
        if (error) throw error;
        
        // Get order details for notification
        const { data: order } = await supabase
            .from('orders')
            .select('customer_phone')
            .eq('id', orderId)
            .single();
        
        if (order?.customer_phone) {
            // Send WhatsApp notification to customer
            await fetch(API + '/whatsapp/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: order.customer_phone,
                    message: '✅ Payment confirmed!\n\nYour order is being prepared. Thank you! 🎉'
                })
            });
        }
        
        addNotif("Order marked as paid and customer notified!");
        fetchOrders(); // Refresh orders list
    } catch (e) {
        addNotif("Failed to mark as paid: " + e.message, "error");
    }
}
```

## Summary

**3 Changes Needed:**
1. ✅ Add MoMo number input field in business settings
2. ✅ Display payment screenshot in order details
3. ✅ Send customer notification when marked as paid

**Files to Modify:**
- `delivagh-dashboard/src/App.jsx` (main dashboard)

**Database:**
- Column already exists: `businesses.momo_number`
- Column already exists: `orders.payment_screenshot_url`
