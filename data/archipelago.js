// Skjærgården: øyene og fergerutene mellom dem. pos er plassen på skjærgårdskartet (0–1).
// Hver øy er sin egen banefil i data/levels/ med village:{at:[x,z]}; fergen går mellom kaiene.
const ISLANDS=[
  {id:'verden', pos:[.50,.52]},
  {id:'sand',   pos:[.18,.80]},
  {id:'stein',  pos:[.82,.84]},
  {id:'skog',   pos:[.16,.26]},
  {id:'elv',    pos:[.84,.24]},
  {id:'vulkan', pos:[.50,.08]},
  {id:'trinnvik', pos:[.50,.84]},
  {id:'gautefall', pos:[.86,.54]},
  {id:'savanne', pos:[.14,.54]},
  {id:'kaiman', pos:[.30,.10]},
  {id:'orken', pos:[.34,.95]},
];
const ROUTES=[['verden','sand'],['verden','stein'],['verden','skog'],['verden','elv'],['verden','vulkan'],['sand','skog'],['stein','elv'],['elv','vulkan'],['sand','stein'],['verden','trinnvik'],['sand','trinnvik'],['stein','trinnvik'],['verden','gautefall'],['elv','gautefall'],['stein','gautefall'],['verden','savanne'],['savanne','skog'],['savanne','sand'],['verden','kaiman'],['skog','kaiman'],['kaiman','vulkan'],['verden','orken'],['orken','trinnvik'],['orken','sand']];
