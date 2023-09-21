// CWE-78/356
stderr = error + (stderr ? format('Wmic reported the following error: %s.', stderr) : 'Wmic reported no errors (stderr empty).')