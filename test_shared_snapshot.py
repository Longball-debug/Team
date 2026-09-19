import copy
import json
import unittest
from unittest.mock import patch
from shared_snapshot import build_pool, normalize_transactions, fetch_transactions
import test_public_snapshot


class PoolTests(unittest.TestCase):
    def setUp(self):
        self.rosters = {'rosters': {str(i): {'teamName': 'Desert Rats' if i == 0 else f'Team {i}',
            'rosterItems': [{'id': str(i)}]} for i in range(12)}}
        self.info = {'playerInfo': {str(i): {'status': 'T', 'eligiblePos': 'SP'} for i in range(12)}}
        self.catalogue = {str(i): {'fantraxId': str(i), 'name': f'Last, First {i}', 'team': 'SEA'} for i in range(12)}
        for pid, status in [('free', 'FA'), ('waiver', 'WW'), ('unknown', 'FA')]:
            self.info['playerInfo'][pid] = {'status': status, 'eligiblePos': 'OF'}
            self.catalogue[pid] = {'fantraxId': pid, 'name': 'Test, Player', 'team': 'NYM'}
        self.catalogue['unknown']['fantraxId'] = 'wrong-id'

    def test_verified_statuses_and_exact_name_match(self):
        pool = {p['fantraxId']: p for p in build_pool(self.info, self.rosters, self.catalogue)}
        for pid, expected in [('0', 'DESERT RATS'), ('1', 'OTHER TEAM'), ('free', 'FREE AGENT'), ('waiver', 'WAIVERS'), ('unknown', 'UNKNOWN')]:
            self.assertEqual(pool[pid]['availability'], expected)
        self.assertEqual(pool['0']['name'], 'First 0 Last')
        self.assertEqual(pool['unknown']['name'], 'Name unavailable')
        self.assertIsNone(pool['free']['teamId'])

    def test_conflicting_ownership_rejected(self):
        self.rosters['rosters']['1']['rosterItems'].append({'id': '0'})
        with self.assertRaises(ValueError): build_pool(self.info, self.rosters, self.catalogue)

    def test_missing_sources_rejected(self):
        for info, rosters, catalogue in [({}, self.rosters, self.catalogue), (self.info, {}, self.catalogue), (self.info, self.rosters, {})]:
            with self.assertRaises(ValueError): build_pool(info, rosters, catalogue)

    def test_conflicting_status_is_unknown(self):
        self.info['playerInfo']['0']['status'] = 'FA'
        self.assertEqual(next(p for p in build_pool(self.info, self.rosters, self.catalogue) if p['fantraxId'] == '0')['availability'], 'UNKNOWN')


class TransactionTests(unittest.TestCase):
    def rows(self):
        return [{'executed': True, 'deleted': False, 'txSetId': 'tx', 'transactionCode': 'DROP',
                 'scorer': {'scorerId': 'p1', 'name': 'Player One'}, 'cells': []},
                {'executed': True, 'txSetId': 'tx', 'transactionCode': 'CLAIM',
                 'scorer': {'scorerId': 'p2', 'name': 'Player Two'},
                 'cells': [{'key': 'team', 'content': 'Desert Rats', 'teamId': '0'},
                           {'key': 'date', 'content': 'Source date text'}], 'private': 'SECRET_SENTINEL'}]

    def payload(self, rows):
        return {'responses': [{'data': {'table': {'rows': rows}}}]}

    def test_group_context_and_allowlist(self):
        result = normalize_transactions(self.payload(self.rows()))
        self.assertEqual([r['action'] for r in result], ['DROP', 'ADD'])
        self.assertEqual(result[0]['teamId'], '0')
        self.assertEqual(result[0]['date'], 'Source date text')
        self.assertNotIn('SECRET_SENTINEL', json.dumps(result))

    def test_empty_is_distinct_from_unavailable(self):
        self.assertEqual(normalize_transactions(self.payload([])), [])
        for payload in ({}, {'responses': []}, self.payload(None)):
            with self.assertRaises(ValueError): normalize_transactions(payload)

    def test_unexecuted_deleted_and_unrelated_excluded(self):
        for change in ({'executed': False}, {'deleted': True}, {'transactionCode': 'TRADE'}):
            row = self.rows()[0] | change
            self.assertEqual(normalize_transactions(self.payload([row])), [])

    def test_duplicate_or_missing_identity_rejected(self):
        row = self.rows()[0]
        with self.assertRaises(ValueError): normalize_transactions(self.payload([row, row]))
        row['scorer'] = {}
        with self.assertRaises(ValueError): normalize_transactions(self.payload([row]))

    @patch('shared_snapshot.urllib.request.urlopen')
    def test_request_matches_existing_site(self, open_url):
        import io
        open_url.return_value.__enter__.return_value = io.StringIO(json.dumps(self.payload([])))
        self.assertEqual(fetch_transactions('league'), [])
        request = open_url.call_args.args[0]
        message = json.loads(request.data)['msgs'][0]
        self.assertEqual(message['method'], 'getTransactionDetailsHistory')
        self.assertEqual(message['data']['view'], 'CLAIM_DROP')
        self.assertTrue(message['data']['executedOnly'])


class ExtendedPublicationTests(unittest.TestCase):
    def setUp(self):
        fixture = test_public_snapshot.PublicationTests()
        fixture.setUp()
        self.fixture = fixture

    def test_incomplete_or_conflicting_pool_rejected(self):
        for kind in ('missing', 'duplicate', 'ownership', 'availability', 'extra_field'):
            with self.subTest(kind=kind):
                self.setUp()
                pool = self.fixture.data['pool']
                if kind == 'missing': pool.pop()
                if kind == 'duplicate': pool.append(copy.deepcopy(pool[0]))
                if kind == 'ownership': pool[0]['teamId'] = '1'
                if kind == 'availability': pool[0]['availability'] = 'FREE AGENT'
                if kind == 'extra_field': pool[0]['private_note'] = 'secret'
                with self.assertRaises(ValueError): self.fixture.build()

    def test_optional_transactions_and_timestamp(self):
        result = self.fixture.build()
        self.assertIsNone(result['transactions'])
        self.assertIn('transactions', result['unavailable'])
        self.assertNotIn('free_agents', result['unavailable'])
        self.fixture.data['transactions'] = []
        result = self.fixture.build()
        self.assertNotIn('transactions', result['unavailable'])
        self.assertEqual(result['generated_at'], self.fixture.data['generated_at'])
        self.assertEqual(json.loads(json.dumps(result, allow_nan=False)), result)


if __name__ == '__main__':
    unittest.main()
