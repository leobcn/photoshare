package routes

import (
	"github.com/danjac/photoshare/api/models"
	"github.com/danjac/photoshare/api/session"
	"net/http"
)

func signup(w http.ResponseWriter, r *http.Request) error {

	user := models.NewUser(
		r.FormValue("name"),
		r.FormValue("email"),
		r.FormValue("password"),
	)

	if result, err := user.Validate(); err != nil || !result.OK {
		if err != nil {
			return err
		}
		return render(w, http.StatusBadRequest, result)
	}

	if err := user.Save(); err != nil {
		return err
	}

	if err := session.Login(w, user); err != nil {
		return err
	}

	return render(w, http.StatusOK, user)

}