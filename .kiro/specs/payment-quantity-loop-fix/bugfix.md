# Bugfix Requirements Document

## Introduction

This document addresses two critical infinite loop bugs in the WhatsApp bot that prevent customers from completing their orders. Both bugs cause the bot to repeat the same question indefinitely, creating a poor user experience and blocking order completion.

**Bug 1 (Payment Method Loop)**: After a customer selects "MoMo" payment by replying "1" or "momo", the bot repeats the payment method prompt instead of asking for the MoMo number.

**Bug 2 (Quantity Loop)**: When using Cerebras AI as the fallback provider, the bot repeatedly asks "How many?" and treats the quantity response as a new item name, never adding items to the cart.

Both bugs share a common pattern: the bot fails to properly transition to the next conversation state, causing it to re-process the same context and repeat the same question.

---

## Bug Analysis

### Current Behavior (Defect)

#### Bug 1: Payment Method Selection Loop

1.1 WHEN customer replies "1" or "momo" to the payment method prompt ("How would you like to pay? 1. MoMo 📱 2. Cash on pickup") THEN the system sends the MoMo number prompt ("MoMo it is! 📱 What's your MoMo number...") but does not update the `checkout_phase` session field

1.2 WHEN the next customer message arrives after selecting MoMo THEN the system still detects the previous "reply 1 or 2" context in `lastBotMsg` and triggers the payment method shortcut again (lines 1741-1760 in whatsappController.js)

1.3 WHEN the payment method shortcut triggers repeatedly THEN the system sends the same payment method prompt in an infinite loop, never progressing to collect the MoMo number

#### Bug 2: Quantity Collection Loop with Cerebras AI

1.4 WHEN Cerebras AI is used as the fallback provider and asks "How many [item] would you like?" THEN the customer provides a quantity (e.g., "1")

1.5 WHEN the quantity response is processed THEN the system does not detect it as a quantity (no `[quantity-detect]` log output appears) and treats the number as a new item name

1.6 WHEN the number is treated as a new item THEN the bot asks "How many 1 would you like?" creating an infinite loop where each quantity becomes a new item

1.7 WHEN Cerebras AI processes the quantity response THEN it does not output the `CART_UPDATE:` line, so the cart is never saved to the database (lines 1847-1860 in whatsappController.js)

### Expected Behavior (Correct)

#### Bug 1: Payment Method Selection Should Progress

2.1 WHEN customer replies "1" or "momo" to the payment method prompt THEN the system SHALL send the MoMo number prompt AND update the `checkout_phase` session field to `'awaiting_momo_number'`

2.2 WHEN the next customer message arrives after the `checkout_phase` is set to `'awaiting_momo_number'` THEN the system SHALL NOT trigger the payment method shortcut again

2.3 WHEN the customer provides their MoMo number after selecting MoMo THEN the system SHALL process the MoMo number and continue with the order flow without repeating the payment method prompt

#### Bug 2: Quantity Should Be Detected and Cart Updated

2.4 WHEN any AI provider (including Cerebras) asks "How many [item] would you like?" and the customer provides a quantity THEN the system SHALL detect the quantity using the case-insensitive regex `/how many/i` (lines 145-160 in ai.js)

2.5 WHEN a quantity is detected THEN the system SHALL output `CART_UPDATE:{"items":[...]}` on its own line to trigger cart saving

2.6 WHEN the `CART_UPDATE:` line is output THEN the system SHALL save the cart to the database (lines 1847-1860 in whatsappController.js) and show the cart summary

2.7 WHEN the cart is saved THEN the system SHALL NOT ask "How many?" again for the same item

### Unchanged Behavior (Regression Prevention)

#### Payment Flow Preservation

3.1 WHEN customer selects "2" or "cash" for payment method THEN the system SHALL CONTINUE TO ask for special requests without updating `checkout_phase` to `'awaiting_momo_number'`

3.2 WHEN customer is in delivery address phase (`checkout_phase: 'awaiting_delivery_address'`) THEN the system SHALL CONTINUE TO accept the address and transition to payment method selection

3.3 WHEN customer selects pickup instead of delivery THEN the system SHALL CONTINUE TO skip the delivery address phase and go directly to payment method selection

#### Quantity Detection Preservation

3.4 WHEN Groq AI (primary provider) asks "How many [item] would you like?" and customer provides quantity THEN the system SHALL CONTINUE TO detect the quantity and output `CART_UPDATE:` correctly

3.5 WHEN customer types "menu" or "checkout" during any phase THEN the system SHALL CONTINUE TO handle these shortcuts correctly without interference from quantity detection

3.6 WHEN customer provides a quantity for an item with a valid price in the menu THEN the system SHALL CONTINUE TO calculate the correct total and save it to the cart

#### Session State Preservation

3.7 WHEN `checkout_phase` is set to `'awaiting_delivery_address'` (line 1710 in whatsappController.js) THEN the system SHALL CONTINUE TO use this phase hint for the next message

3.8 WHEN customer completes an order and starts a new conversation THEN the system SHALL CONTINUE TO reset the session state appropriately

---

## Bug Condition Analysis

### Bug 1: Payment Method Loop

**Bug Condition Function:**
```pascal
FUNCTION isBugCondition_PaymentLoop(X)
  INPUT: X of type CustomerMessage
  OUTPUT: boolean
  
  // X.message: customer's message content
  // X.lastBotMsg: last bot message in conversation history
  // X.checkoutPhase: current checkout_phase from session
  
  RETURN (X.message MATCHES /^(momo|1)$/i) AND
         (X.lastBotMsg MATCHES /reply 1 or 2/i) AND
         (X.checkoutPhase != 'awaiting_momo_number')
END FUNCTION
```

**Property Specification:**
```pascal
// Property: Fix Checking - Payment Method Should Update Session
FOR ALL X WHERE isBugCondition_PaymentLoop(X) DO
  result ← handlePaymentMethodShortcut'(X)
  ASSERT result.checkoutPhase = 'awaiting_momo_number' AND
         result.response MATCHES /MoMo number/i AND
         result.nextMessage_will_not_trigger_shortcut = true
END FOR
```

**Preservation Goal:**
```pascal
// Property: Preservation Checking - Other Payment Flows Unchanged
FOR ALL X WHERE NOT isBugCondition_PaymentLoop(X) DO
  ASSERT handlePaymentMethodShortcut(X) = handlePaymentMethodShortcut'(X)
END FOR
```

### Bug 2: Quantity Loop

**Bug Condition Function:**
```pascal
FUNCTION isBugCondition_QuantityLoop(X)
  INPUT: X of type CustomerMessage
  OUTPUT: boolean
  
  // X.message: customer's message content (e.g., "1", "2")
  // X.lastBotMsg: last bot message
  // X.aiProvider: current AI provider (e.g., "cerebras")
  
  RETURN (X.lastBotMsg MATCHES /how many .+ would you like/i) AND
         (X.message MATCHES /^\d+$/) AND
         (X.aiProvider = 'cerebras' OR quantity_detection_fails)
END FUNCTION
```

**Property Specification:**
```pascal
// Property: Fix Checking - Quantity Should Be Detected and Cart Updated
FOR ALL X WHERE isBugCondition_QuantityLoop(X) DO
  result ← processQuantityResponse'(X)
  ASSERT result.cartUpdated = true AND
         result.response INCLUDES 'CART_UPDATE:' AND
         result.response NOT_MATCHES /how many/i AND
         result.cartSavedToDatabase = true
END FOR
```

**Preservation Goal:**
```pascal
// Property: Preservation Checking - Other Quantity Flows Unchanged
FOR ALL X WHERE NOT isBugCondition_QuantityLoop(X) DO
  ASSERT processQuantityResponse(X) = processQuantityResponse'(X)
END FOR
```

---

## Counterexamples

### Bug 1: Payment Method Loop

**Concrete Example:**
```
Conversation History:
- Bot: "Great! Pickup order. How would you like to pay? 1. MoMo 📱 2. Cash on pickup. Reply 1 or 2"
- Customer: "1"
- Bot: "MoMo it is! 📱 What's your MoMo number..."
- Customer: "0241234567"
- Bot: "Great! Pickup order. How would you like to pay? 1. MoMo 📱 2. Cash on pickup. Reply 1 or 2" ❌ LOOP

Session State:
- checkout_phase: null (NOT updated to 'awaiting_momo_number')
- lastBotMsg: "Great! Pickup order. How would you like to pay?..."
```

**Why it loops:**
The shortcut at line 1741 checks: `/momo.*cash|pay.*method|reply 1 or 2/i.test(lastBotMsg)` and `/^(momo|cash|1|2)$/i.test(msgLowerTrimmed)`. Since `checkout_phase` was never updated, the next message "0241234567" doesn't match the shortcut pattern, but when the customer tries again with "1", it triggers the shortcut again because `lastBotMsg` still contains "reply 1 or 2".

### Bug 2: Quantity Loop

**Concrete Example:**
```
Conversation History:
- Customer: "water"
- Bot (Cerebras): "How many water would you like?"
- Customer: "1"
- Bot (Cerebras): "Boadi, how many 1 would you like?" ❌ LOOP
- Customer: "1"
- Bot (Cerebras): "Boadi, how many 1 would you like?" ❌ LOOP CONTINUES

Logs:
- No [quantity-detect] output
- No CART_UPDATE: line in AI response
- Cart remains empty in database
```

**Why it loops:**
The quantity detection code (lines 145-160 in ai.js) should detect "How many" and set `waitingForQuantity = true`, but either:
1. The conversation history isn't being passed correctly to Cerebras
2. The `phaseBlock` for quantity isn't being applied
3. Cerebras doesn't follow the instruction to output `CART_UPDATE:`

The controller never sees `CART_UPDATE:` so the cart is never saved, and the AI treats "1" as a new item name.
