"""Offline regression tests: no private file is read, no real HTTP request."""
import contextlib, importlib.util, io, json, pathlib, unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('sync',pathlib.Path(__file__).with_name('sync-gercek.py'))
sync=importlib.util.module_from_spec(spec);spec.loader.exec_module(sync)
class SyncTests(unittest.TestCase):
    def test_public_product_urls_remove_merchant_identity_only(self):
        product={'id':'stable-product','channel':'Trendyol','title':'Fanila','image':'','url':'https://www.trendyol.com/urun-p-42?merchantId=EXAMPLE&filterOverPriceListings=false','price':100,'stock':8}
        result=sync.compact_snapshot({'products':[product.copy()],'orders':[]})['products'][0]
        self.assertEqual(result['url'],'https://www.trendyol.com/urun-p-42?filterOverPriceListings=false')
        self.assertEqual({k:v for k,v in result.items() if k!='url'},{k:v for k,v in product.items() if k!='url'})
        self.assertEqual(sync.public_product_url('https://example.invalid/product?variant=M'),'https://example.invalid/product?variant=M')
    def test_public_snapshot_has_no_order_amounts(self):
        result=sync.compact_snapshot({'products':[],'orders':[{'id':'anonymous','total':123.45,'lines':[{'qty':2,'total':123.45}]}]})
        self.assertNotIn('total',result['orders'][0])
        self.assertNotIn('total',result['orders'][0]['lines'][0])
    def test_ikas_refuses_mutation_before_http(self):
        spec=importlib.util.spec_from_file_location('ikas',pathlib.Path(__file__).with_name('ikas-read.py'))
        ikas=importlib.util.module_from_spec(spec);spec.loader.exec_module(ikas)
        with patch.object(ikas.sync.opener,'open') as request:
            for query in ['mutation Save { saveProduct { id } }','query Read { me { id } } mutation Save { saveProduct { id } }']:
                with self.assertRaises(ValueError):ikas.post('https://api.myikas.com/api/v1/admin/graphql',{'query':query},'fake-test-token')
            request.assert_not_called()
    def test_numeric_product_sku_is_not_a_phone(self):
        self.assertEqual(sync.sku('1234567890123'),'1234567890123')
        self.assertEqual(sync.clean('+90 555 000 00 00'),'[maskeli]')
    def test_requests_are_get_and_auth_is_not_in_url(self):
        captured=[]
        class Response:
            def __enter__(self):return io.StringIO('{}')
            def __exit__(self,*args):return False
        class Opener:
            def open(self,request,timeout):captured.append(request);return Response()
        with patch.object(sync,'opener',Opener()),patch.object(sync.time,'sleep'):
            sync.get('https://example.invalid/products',{'page':1},'demo:credential')
        self.assertEqual(captured[0].get_method(),'GET')
        self.assertNotIn('credential',captured[0].full_url)
        self.assertNotIn('demo',captured[0].full_url)
    def test_customer_data_and_line_metadata_never_enter_snapshot(self):
        def fake(url,params,auth):
            if url.endswith('/products'):
                return [{'id':1,'name':'Fanila','sku':'1234567890123','price':'100','images':[],'stock_quantity':8}]
            return [{'id':1,'date_created':'2026-11-24T12:00:00','total':'200','status':'completed','billing':{'first_name':'PRIVATE-CUSTOMER','email':'private@example.invalid','phone':'PRIVATE-PHONE'},'shipping':{'address_1':'PRIVATE-ADDRESS'},'line_items':[{'product_id':1,'variation_id':0,'name':'Fanila','sku':'1234567890123','quantity':2,'total':'200','meta_data':[{'key':'name','value':'PRIVATE-CUSTOMER'}]}]}]
        out={'products':[],'orders':[]}
        with patch.object(sync,'get',fake),contextlib.redirect_stdout(io.StringIO()):sync.woo('example.invalid','demo:credential',out)
        data=json.dumps(out)
        for secret in ['PRIVATE-CUSTOMER','PRIVATE-PHONE','PRIVATE-ADDRESS','private@example.invalid','billing','shipping','meta_data']:
            self.assertNotIn(secret,data)
        self.assertEqual(out['products'][0]['sku'],'1234567890123')
        self.assertEqual(set(out['orders'][0]),{'id','channel','date','total','status','lines'})
    def test_multiple_packages_are_one_order(self):
        rows=[{'id':'same-anonymous-id','status':'Delivered','total':100,'lines':[{'qty':1}]},{'id':'same-anonymous-id','status':'Delivered','total':50,'lines':[{'qty':2}]}]
        result=sync.group_orders(rows)
        self.assertEqual(len(result),1);self.assertEqual(result[0]['total'],150)
        self.assertEqual(sum(l['qty'] for l in result[0]['lines']),3)
if __name__=='__main__':unittest.main()
