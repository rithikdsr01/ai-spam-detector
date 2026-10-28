import json
from app import app

client = app.test_client()

# 1. Test GET /
res_home = client.get('/')
assert res_home.status_code == 200, f'Home failed: {res_home.status_code}'
assert b'AI' in res_home.data and b'Spam' in res_home.data
print('Test 1 Passed: GET / returns 200 and loads HTML dashboard.')

# 2. Test POST /api/predict (Spam)
spam_payload = {'message': 'WINNER! You have been selected to win a £1,000 cash prize. Call 09061701461 to claim your reward now!'}
res_spam = client.post('/api/predict', json=spam_payload)
assert res_spam.status_code == 200, f'Predict spam failed: {res_spam.status_code}'
data_spam = json.loads(res_spam.data)
assert data_spam['prediction'] == 'Spam', f"Expected Spam, got {data_spam['prediction']}"
assert data_spam['is_spam'] is True
assert data_spam['spam_probability'] > 85.0
assert len(data_spam['keywords']) > 0
print(f"Test 2 Passed: Spam prediction successful (Confidence: {data_spam['confidence']}%, Keywords: {data_spam['keywords'][:3]}).")

# 3. Test POST /api/predict (Ham)
ham_payload = {'message': 'Hey, are we still meeting for lunch at 1 PM today? Let me know!'}
res_ham = client.post('/api/predict', json=ham_payload)
assert res_ham.status_code == 200, f'Predict ham failed: {res_ham.status_code}'
data_ham = json.loads(res_ham.data)
assert data_ham['prediction'] == 'Not Spam', f"Expected Not Spam, got {data_ham['prediction']}"
assert data_ham['is_spam'] is False
assert data_ham['ham_probability'] > 85.0
print(f"Test 3 Passed: Ham prediction successful (Confidence: {data_ham['confidence']}%, Prob: {data_ham['ham_probability']}% ham).")

# 4. Test GET /api/history
res_hist = client.get('/api/history')
assert res_hist.status_code == 200
hist_data = json.loads(res_hist.data)
assert len(hist_data) >= 2
print(f"Test 4 Passed: History endpoint returned {len(hist_data)} records.")

# 5. Test GET /api/analytics
res_ana = client.get('/api/analytics')
assert res_ana.status_code == 200
ana_data = json.loads(res_ana.data)
assert 'summary' in ana_data and 'metrics' in ana_data
print(f"Test 5 Passed: Analytics endpoint returned stats (Total: {ana_data['summary']['total_analyzed']}, Accuracy: {ana_data['metrics']['accuracy']}%)")

# 6. Test GET /api/model-info
res_info = client.get('/api/model-info')
assert res_info.status_code == 200
info_data = json.loads(res_info.data)
assert info_data['model_name'] == 'Multinomial Naive Bayes'
print("Test 6 Passed: Model info endpoint returned correct architecture specs.")

# 7. Test DELETE /api/history/<id>
created_id = data_spam['id']
res_del = client.delete(f'/api/history/{created_id}')
assert res_del.status_code == 200
print(f"Test 7 Passed: Successfully deleted record #{created_id}.")

print('\nALL 7 TESTS PASSED FLAWLESSLY!')
