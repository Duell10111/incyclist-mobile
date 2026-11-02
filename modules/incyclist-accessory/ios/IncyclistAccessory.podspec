Pod::Spec.new do |s|
  s.name           = 'IncyclistAccessory'
  s.version        = '1.0.0'
  s.summary        = 'External Accessory (MFi) sessions for Incyclist'
  s.description    = 'Exposes External Accessory sessions (e.g. Kettler Racer S) as byte streams to JS'
  s.author         = 'Incyclist'
  s.homepage       = 'https://github.com/incyclist/mobile'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.5' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'ExternalAccessory'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,swift}"
end
