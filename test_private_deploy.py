import unittest
from unittest.mock import patch,Mock
from verify_private import access_gate
class PrivateDeploymentTests(unittest.TestCase):
    def test_public_success_cannot_pass_private_preflight(self):
        with patch('urllib.request.build_opener') as opener:
            opener.return_value.open.return_value=Mock(status=200,headers={})
            self.assertFalse(access_gate('https://example.test/'))
    def test_only_real_access_redirect_passes(self):
        for url,expected in [('https://rats.cloudflareaccess.com/cdn-cgi/access/login',True),('https://cloudflareaccess.com.attacker.test/',False),('https://example.test/login',False)]:
            with self.subTest(url=url),patch('urllib.request.build_opener') as opener:
                opener.return_value.open.return_value=Mock(status=302,headers={'Location':url})
                self.assertEqual(access_gate('https://example.test/'),expected)
