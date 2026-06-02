(do
  (def doc-lib (require @d0d0d0d0-0020-0000-0000-000000000000))
  (def now-ms (.getTime (js/Date.)))
  (def today-start
    (let [d (js/Date.)]
      (.setHours d 0 0 0 0)))
  (def tomorrow-start (+ today-start 86400000))
  (def day-after-start (+ tomorrow-start 86400000))
  (def all-items
    (->> (find-items {:type "521cb06c-2146-47f1-9375-1207bb6b5b27"})
         (sort-by (fn [x] (or ($ x :scheduledAt) 99999999999999)))))
  (defn fmt-datetime [val item]
    (if (nil? val)
      ""
      (.toLocaleString (js/Date. val))))
  (defn fmt-time-only [val item]
    (if (nil? val)
      ""
      (.toLocaleTimeString (js/Date. val))))
  (defn reminder-table [items fmt]
    (doc-lib/item-table items :name [:scheduledAt fmt]))
  (def overdue
    (filter (fn [x] (let [t ($ x :scheduledAt)] (and t (< t now-ms)))) all-items))
  (def unscheduled
    (filter (fn [x] (nil? ($ x :scheduledAt))) all-items))
  (def today
    (filter (fn [x] (let [t ($ x :scheduledAt)] (and t (>= t now-ms) (< t tomorrow-start)))) all-items))
  (def tomorrow
    (filter (fn [x] (let [t ($ x :scheduledAt)] (and t (>= t tomorrow-start) (< t day-after-start)))) all-items))
  (def later
    (filter (fn [x] (let [t ($ x :scheduledAt)] (and t (>= t day-after-start)))) all-items))
  (reduce conj [:doc]
    (concat
      (when (seq overdue)     [[:h3 "Overdue"]     (reminder-table overdue fmt-datetime)])
      (when (seq unscheduled) [[:h3 "Unscheduled"] (reminder-table unscheduled fmt-datetime)])
      (when (seq today)       [[:h3 "Today"]       (reminder-table today fmt-time-only)])
      (when (seq tomorrow)    [[:h3 "Tomorrow"]    (reminder-table tomorrow fmt-time-only)])
      (when (seq later)       [[:h3 "Later"]       (reminder-table later fmt-datetime)]))))
