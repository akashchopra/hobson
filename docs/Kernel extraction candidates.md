  Extraction criteria:                                                                                        
  1. Kernel doesn't need it to bootstrap/function                                                             
  2. Multiple user code items (renderers/libraries) would call it                                             
  3. It's a genuine utility (not a complete UI)                                                               
  4. Provides reusable functionality                                                                          
                                                                                                              
  ---                                                                                                         
  Re-Assessment: What Should Actually Be Extracted?                                                           
                                                                                                              
  TIER 1: Complete UIs → Should Be RENDERERS (Not Libraries)                                                  
                                                                                                              
  1. showItemList()                                                                                           
  - ❌ Not a library - it's a complete UI                                                                     
  - ✅ Should become a renderer for a "list_view" or "directory" item type                                    
  - Kernel doesn't need it for bootstrap (currently just a navigation option)                                 
  - Action: Extract as renderer, not library                                                                  
                                                                                                              
  2. createREPL()                                                                                             
  - ❌ Not a library - it's a complete UI component                                                           
  - ✅ Should become a renderer for a "repl" item type (if modularizing)                                      
  - Kernel currently needs it for the built-in REPL, but that could be refactored                             
  - Action: Extract as renderer, not library (if separating kernel from shell)                                
                                                                                                              
  3. createNavBar()                                                                                           
  - ❌ Not a library - it's a UI component                                                                    
  - Part of kernel's default chrome/shell                                                                     
  - Not a utility function                                                                                    
  - Action: Keep in kernel (or make part of viewport/shell renderer)                                          
                                                                                                              
  4. createErrorView()                                                                                        
  - ❌ Not a library                                                                                          
  - Kernel needs it as fallback error display                                                                 
  - Action: Keep in kernel                                                                                    
                                                                                                              
  TIER 2: Kernel Core → Keep in Kernel                                                                        
                                                                                                              
  5. typeChainIncludes()                                                                                      
  - ❌ Kernel needs it to function (findRenderer depends on it)                                               
  - Already exposed via API                                                                                   
  - Action: Keep in kernel, expose via API (already done) ✓                                                   
                                                                                                              
  6. findRenderer() / getRenderers()                                                                          
  - ❌ Kernel needs findRenderer() to discover renderers                                                      
  - getRenderers() builds on kernel infrastructure                                                            
  - Not genuine utilities - kernel concerns                                                                   
  - Action: Keep in kernel (expose getRenderers via API if needed)                                            
                                                                                                              
  7. getEditors() / findEditors()                                                                             
  - ❌ Kernel infrastructure for editor discovery                                                             
  - Action: Keep in kernel (expose via API if needed)                                                         
                                                                                                              
  8. attach() / detach()                                                                               
  - ❌ Kernel needs these for container operations                                                            
  - Already exposed via API: api.attach(), api.detach()                                                
  - Action: Keep in kernel, expose via API (already done) ✓                                                   
                                                                                                              
  9. wouldCreateCycle()                                                                                       
  - ❌ Internal validation for attach()                                                                     
  - Not user-facing                                                                                           
  - Action: Keep in kernel                                                                                    
                                                                                                              
  10. findContainerOf()                                                                                          
  - ❌ Internal query utility                                                                                 
  - Simple enough that if needed, could be exposed via API                                                    
  - Not worth extracting to library                                                                           
  - Action: Keep in kernel (maybe expose via API)                                                             
                                                                                                              
  11. deleteItem()                                                                                            
  - ❌ Kernel data management                                                                                 
  - Action: Keep in kernel                                                                                    
                                                                                                              
  TIER 3: UI Components → Not Libraries                                                                       
                                                                                                              
  12. addTranscriptEntry()                                                                                    
  - ❌ Specific to REPL UI                                                                                    
  - Would be part of REPL renderer if extracted                                                               
  - Not a general utility                                                                                     
  - Action: Keep in kernel (or move with REPL if extracting)                                                  
                                                                                                              
  13. showEditorModal() / hideEditorModal()                                                                   
  - 🤔 Generic modal framework - borderline case                                                              
  - Used by editItemRaw() currently                                                                           
  - Question: Is this a common enough pattern for renderers?                                                  
  - If yes: Could be a library                                                                                
  - If no: Keep in kernel or let renderers implement their own                                                
  - Action: Probably keep in kernel for now - not clear value as library                                      
                                                                                                              
  14. editItemRaw() / createNewItem()                                                                         
  - ❌ Complete UIs with kernel dependencies                                                                  
  - Could become renderers, but they're kernel utilities                                                      
  - Action: Keep in kernel (part of dev/admin UI)                                                             
                                                                                                              
  ---                                                                                                         
  Revised Conclusion                                                                                          
                                                                                                              
  Should Be Extracted:                                                                                        
                                                                                                              
  None to libraries.                                                                                          
                                                                                                              
  The only candidates for extraction are:                                                                     
  1. showItemList() → Extract as RENDERER (for "list_view" type)                                              
  2. createREPL() → Maybe extract as RENDERER (if separating shell from kernel)                               
                                                                                                              
  Should Stay in Kernel:                                                                                      
                                                                                                              
  Everything else. The kernel is already quite minimal:                                                       
  - Type system core (typeChainIncludes, findRenderer)                                                        
  - Storage operations                                                                                        
  - Code loading (require, evaluate)                                                                          
  - Container operations (attach, detach)                                                              
  - Rendering pipeline                                                                                        
  - Basic navigation and UI                                                                                   
                                                                                                              
  What About Libraries Then?                                                                                  
                                                                                                              
  Libraries should be NEW utilities that users create, not extracted from kernel. Examples of good library    
  candidates:                                                                                                 
  - Markdown parser (for note renderers)                                                                      
  - Date formatting utilities                                                                                 
  - Geometry/positioning helpers (for spatial layouts)                                                        
  - Common UI patterns (tabs, accordions, etc.)                                                               
  - Search utilities (like your item_search_lib ✓)                                                            
  - Rich text editor components                                                                               
  - Graph traversal algorithms                                                                                
  - Data validation utilities                                                                                 
                                                                                                              
  These are things that:                                                                                      
  - Multiple renderers would want                                                                             
  - Kernel doesn't need                                                                                       
  - Are genuinely reusable utilities                                                                          
                                                                                                              
  ---                                                                                                         
  The Real Answer                                                                                             
                                                                                                              
  The kernel code is already appropriately minimal. The distinction should be:                                
                                                                                                              
  1. Kernel = Bootstrap essentials + infrastructure                                                           
  2. Renderers = Complete UIs (could extract showItemList)                                                    
  3. Libraries = Reusable utilities (create new ones, don't extract from kernel)                              
                                                                                                              
  The only realistic extraction from current kernel is showItemList() as a renderer, not as a library.        
                                                                                                              
  Does this reassessment match your thinking better?  
