c=open('src/Onboarding.jsx','r',encoding='utf-8').read()
dq=chr(34)
bt=chr(96)
ds=chr(36)
nl=chr(10)
old='                                    <textarea'+nl+'                                        className='+dq+'ob-input'+dq+nl+'                                        value={botGreeting}'
new='                                    <div style={{ display: '+dq+'flex'+dq+', flexDirection: '+dq+'column'+dq+' }}>'+nl+'                                        <label style={{ display: '+dq+'block'+dq+', fontSize: '+dq+'11px'+dq+', fontWeight: '+dq+'600'+dq+', color: '+dq+'rgba(236,253,243,0.5)'+dq+', marginBottom: '+dq+'7px'+dq+', textTransform: '+dq+'uppercase'+dq+', letterSpacing: '+dq+'0.07em'+dq+' }}>WELCOME GREETING <span style={{ fontWeight: '+dq+'400'+dq+', textTransform: '+dq+'none'+dq+', letterSpacing: 0, color: '+dq+'rgba(236,253,243,0.3)'+dq+' }}>optional</span></label>'+nl+'                                        <textarea'+nl+'                                            className='+dq+'ob-input'+dq+nl+'                                            rows={3}'+nl+'                                            value={botGreeting}'
c=c.replace(old,new)
open('src/Onboarding.jsx','w',encoding='utf-8').write(c)
print('ok')
