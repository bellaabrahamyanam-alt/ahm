import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']) if __import__('os').path.exists('/usr/bin/google-chrome') else p.chromium.launch()
    pg=b.new_page(viewport={'width':1000,'height':1000},device_scale_factor=2)
    errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+__import__('os').getcwd()+'/sidebar.html')
    print('errors',errs)
    for el in pg.query_selector_all('.frame'):
        i=el.get_attribute('id'); el.screenshot(path=f'{i}.png')
    b.close()
