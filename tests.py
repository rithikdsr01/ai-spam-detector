import json
from app import app

client = app.test_client()

# 1. Test GET /
res_home = client.get('/')
assert res_home.status_code == 200, f'Home failed: {res_home.status_code}'
assert b'Receipt Scanner' in res_home.data and b'SMS Detector' in res_home.data
print('Test 1 Passed: GET / returns 200 and loads HTML dashboard with Receipt Scanner.')

# 2. Test POST /api/predict (Spam)
spam_payload = {'message': 'WINNER! You have been selected to win a £1,000 cash prize. Call 09061701461 to claim your reward now!'}
res_spam = client.post('/api/predict', json=spam_payload)
assert res_spam.status_code == 200
data_spam = json.loads(res_spam.data)
assert data_spam['prediction'] == 'Spam'
assert data_spam['is_spam'] is True
print(f"Test 2 Passed: SMS Spam prediction successful ({data_spam['confidence']}%).")

# 3. Test POST /api/predict (Ham)
ham_payload = {'message': 'Hey, are we still meeting for lunch at 1 PM today? Let me know!'}
res_ham = client.post('/api/predict', json=ham_payload)
assert res_ham.status_code == 200
data_ham = json.loads(res_ham.data)
assert data_ham['prediction'] == 'Not Spam'
assert data_ham['is_spam'] is False
print(f"Test 3 Passed: SMS Ham prediction successful ({data_ham['confidence']}%).")

# 4. Test POST /api/scan-receipt (Fake Sample)
res_fake = client.post('/api/scan-receipt', data={'sample_type': 'fake', 'engine': 'auto'})
assert res_fake.status_code == 200
data_fake = json.loads(res_fake.data)
assert data_fake['verdict'] == 'SCAM'
assert data_fake['is_scam'] is True
assert data_fake['risk_score'] >= 70
print(f"Test 4 Passed: Fake Receipt Scan detected SCAM (Risk Score: {data_fake['risk_score']}/100, App: {data_fake['extracted_details']['app_or_bank']}).")

# 5. Test POST /api/scan-receipt (Real Sample)
res_real = client.post('/api/scan-receipt', data={'sample_type': 'real', 'engine': 'auto'})
assert res_real.status_code == 200
data_real = json.loads(res_real.data)
assert data_real['verdict'] == 'LEGITIMATE'
assert data_real['is_scam'] is False
print(f"Test 5 Passed: Authentic Receipt Scan verified (Risk Score: {data_real['risk_score']}/100).")

# 6. Test GET /api/receipt-history
res_rhist = client.get('/api/receipt-history')
assert res_rhist.status_code == 200
rhist_data = json.loads(res_rhist.data)
assert len(rhist_data) >= 2
print(f"Test 6 Passed: Receipt History endpoint returned {len(rhist_data)} scan records.")

# 7. Test DELETE /api/receipt-history/<id>
created_rid = data_fake['id']
res_rdel = client.delete(f'/api/receipt-history/{created_rid}')
assert res_rdel.status_code == 200
print(f"Test 7 Passed: Successfully deleted receipt record #{created_rid}.")

# 8. Test GET /api/history & /api/analytics
res_hist = client.get('/api/history')
assert res_hist.status_code == 200
res_ana = client.get('/api/analytics')
assert res_ana.status_code == 200
print("Test 8 Passed: Analytics and message history verified.")

print('\nALL 8 TESTS PASSED FLAWLESSLY (SMS + RECEIPT SCAM SCANNER)!')
